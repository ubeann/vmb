#!/usr/bin/env python3
"""Turn a black-ink-on-paper engraving into the login page's ink mask.

The page draws the etching with CSS `mask-image`, filled with the `--etching`
token, so the source only needs to say *where* ink is: this writes black RGB
with the ink density in the alpha channel. Paper becomes transparent, so the
same file works on the light paper and the dark navy scheme.

Usage: prepare-etching.py <source.png> <out-dir> [--name vmb-etching] [--trim] [--trim-x]
                          [--crop-top 0.1] [--crop-bottom 0.1] [--flip] [--fade-sides 0.06] [--fade-bottom 0.3] [--pad-to 5] [--white 212] [--black 40]

Writes <name>-2400.webp and <name>-1200.webp (needs `cwebp`).
"""

import argparse
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("source")
parser.add_argument("out_dir")
parser.add_argument("--name", default="vmb-etching", help="output file prefix")
parser.add_argument("--white", type=int, default=212, help="luminance treated as bare paper")
parser.add_argument("--black", type=int, default=40, help="luminance treated as full ink")
parser.add_argument("--quality", type=int, default=60)
parser.add_argument("--alpha-quality", type=int, default=50)
parser.add_argument("--trim", action="store_true", help="crop empty paper above and below the ink")
parser.add_argument("--trim-x", action="store_true", help="also crop empty paper left and right of the ink")
parser.add_argument("--crop-top", type=float, default=0, help="fraction of the (trimmed) height to cut from the top")
parser.add_argument("--crop-bottom", type=float, default=0, help="fraction of the (trimmed) height to cut from the bottom")
parser.add_argument("--flip", action="store_true", help="mirror the art left to right")
parser.add_argument("--fade-sides", type=float, default=0, help="fraction of width to fade out at each side")
parser.add_argument("--fade-bottom", type=float, default=0, help="fraction of height to fade out at the bottom")
parser.add_argument("--pad-to", type=float, default=0, help="add blank paper at both sides to reach this width:height ratio")
args = parser.parse_args()

gray = Image.open(args.source).convert("L")
span = max(args.white - args.black, 1)
alpha = gray.point(lambda v: 0 if v >= args.white else 255 if v <= args.black else round((args.white - v) / span * 255))

if args.trim:
    # Rows with meaningful ink (ignoring stray specks), padded by 2% of the height.
    rows = [sum(1 for x in range(0, alpha.width, 8) if alpha.getpixel((x, y)) > 96) for y in range(alpha.height)]
    inked = [y for y, count in enumerate(rows) if count > alpha.width // 800]
    pad = alpha.height // 50
    alpha = alpha.crop((0, max(inked[0] - pad, 0), alpha.width, min(inked[-1] + pad, alpha.height)))

if args.trim_x:
    cols = [sum(1 for y in range(0, alpha.height, 8) if alpha.getpixel((x, y)) > 96) for x in range(alpha.width)]
    inked = [x for x, count in enumerate(cols) if count > 0]
    pad = alpha.height // 50
    alpha = alpha.crop((max(inked[0] - pad, 0), 0, min(inked[-1] + pad, alpha.width), alpha.height))

if args.crop_top or args.crop_bottom:
    # Cut art that isn't needed (foreground tufts, sky) so the rest is drawn larger for the same band height.
    alpha = alpha.crop((0, round(alpha.height * args.crop_top), alpha.width, round(alpha.height * (1 - args.crop_bottom))))

if args.flip:
    alpha = alpha.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

if args.fade_sides:
    # Bake the side fade into the art, so it ends softly wherever CSS places it.
    ramp = max(round(alpha.width * args.fade_sides), 1)
    fade = Image.new("L", alpha.size, 255)
    for x in range(ramp):
        level = round(255 * (x / ramp) ** 1.5)
        fade.paste(level, (x, 0, x + 1, alpha.height))
        fade.paste(level, (alpha.width - 1 - x, 0, alpha.width - x, alpha.height))
    alpha = Image.composite(alpha, Image.new("L", alpha.size, 0), fade)

if args.fade_bottom:
    # Thin the foreground into bare paper, so the plate meets the footer strip without an edge.
    ramp = max(round(alpha.height * args.fade_bottom), 1)
    fade = Image.new("L", alpha.size, 255)
    for y in range(ramp):
        fade.paste(round(255 * (y / ramp) ** 1.5), (0, alpha.height - 1 - y, alpha.width, alpha.height - y))
    alpha = Image.composite(alpha, Image.new("L", alpha.size, 0), fade)

if args.pad_to:
    # Blank paper at both ends, so the plate can bleed off narrow screens without cropping the scene.
    width = round(alpha.height * args.pad_to)
    if width > alpha.width:
        padded = Image.new("L", (width, alpha.height), 0)
        padded.paste(alpha, ((width - alpha.width) // 2, 0))
        alpha = padded

print(f"mask {alpha.width}x{alpha.height} (ratio {alpha.width / alpha.height:.3f})")

out = Path(args.out_dir)
out.mkdir(parents=True, exist_ok=True)
for width in (2400, 1200):
    height = round(alpha.height * width / alpha.width)
    ink = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ink.putalpha(alpha.resize((width, height), Image.Resampling.LANCZOS))
    with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
        ink.save(tmp.name)
        target = out / f"{args.name}-{width}.webp"
        subprocess.run(
            ["cwebp", "-quiet", "-q", str(args.quality), "-alpha_q", str(args.alpha_quality), tmp.name, "-o", str(target)],
            check=True,
        )
        print(target, f"{target.stat().st_size / 1024:.0f} KB")
