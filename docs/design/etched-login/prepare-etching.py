#!/usr/bin/env python3
"""Turn a black-ink-on-paper engraving into the login page's ink mask.

The page draws the etching with CSS `mask-image`, filled with the `--etching`
token, so the source only needs to say *where* ink is: this writes black RGB
with the ink density in the alpha channel. Paper becomes transparent, so the
same file works on the light paper and the dark navy scheme.

Usage: prepare-etching.py <source.png> <out-dir> [--name vmb-etching] [--trim] [--trim-x]
                          [--crop-top 0.1] [--crop-bottom 0.1] [--flip] [--fade-sides 0.06] [--fade-bottom 0.3] [--pad-to 5] [--white 212] [--black 40]
                          [--parts parts.json --manifest out.json] [--plate-source filled.png]

Writes <name>-2400.webp and <name>-1200.webp (needs `cwebp`).

Moving parts (#243): `--parts` names polygons in the source's pixels. Each part
goes through the same crops, flip, fades and padding as the plate, so it lines
up with it exactly, and is written as <name>-<part>-2400.webp and -1200.webp,
cropped to the part. `--manifest` records each part's box as percentages of the
plate. An "opaque" part also hides the plate behind it: its file keeps the ink
as white luminance and the part's silhouette in alpha, for a CSS `luminance`
ink layer over an `alpha` paper backing. A part with "rest" [dx, dy] (source
pixels) comes to rest that far from where it was cut. The plate is drawn from
`--plate-source` (the source with the parts' holes filled, same size); without
it, the parts are cut out of the plate, which suits parts on bare paper. An
"overlay" part (a highlight over the plate) is never cut out, and keeps its
ink at full strength through the plate's fades. A part with "art" (a path
from the parts file, an image the source's size) takes its ink from that
image instead of the source: new art set where it belongs on the master.
"""

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

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
parser.add_argument("--parts", help="JSON of moving parts: {name: {polygon: [[x, y], ...], opaque?, rest?, overlay?}}")
parser.add_argument("--manifest", help="where to write the parts' boxes in plate percentages")
parser.add_argument("--plate-source", help="draw the plate from this image (the source with the parts' holes filled)")
args = parser.parse_args()

WIDTHS = (2400, 1200)


def ink_alpha(path):
    gray = Image.open(path).convert("L")
    span = max(args.white - args.black, 1)
    return gray.point(lambda v: 0 if v >= args.white else 255 if v <= args.black else round((args.white - v) / span * 255))


def plan(alpha):
    """Work out the plate's crops, flip, fades and padding from the source's ink, as steps any layer can replay."""
    steps = []
    width, height = alpha.size

    if args.trim:
        # Rows with meaningful ink (ignoring stray specks), padded by 2% of the height.
        rows = [sum(1 for x in range(0, alpha.width, 8) if alpha.getpixel((x, y)) > 96) for y in range(alpha.height)]
        inked = [y for y, count in enumerate(rows) if count > alpha.width // 800]
        pad = alpha.height // 50
        alpha = alpha.crop((0, max(inked[0] - pad, 0), alpha.width, min(inked[-1] + pad, alpha.height)))
        steps.append(("crop", (0, max(inked[0] - pad, 0), width, min(inked[-1] + pad, height))))

    if args.trim_x:
        cols = [sum(1 for y in range(0, alpha.height, 8) if alpha.getpixel((x, y)) > 96) for x in range(alpha.width)]
        inked = [x for x, count in enumerate(cols) if count > 0]
        pad = alpha.height // 50
        box = (max(inked[0] - pad, 0), 0, min(inked[-1] + pad, alpha.width), alpha.height)
        alpha = alpha.crop(box)
        steps.append(("crop", box))

    if args.crop_top or args.crop_bottom:
        # Cut art that isn't needed (foreground tufts, sky) so the rest is drawn larger for the same band height.
        box = (0, round(alpha.height * args.crop_top), alpha.width, round(alpha.height * (1 - args.crop_bottom)))
        alpha = alpha.crop(box)
        steps.append(("crop", box))

    if args.flip:
        steps.append(("flip", None))

    if args.fade_sides:
        # Bake the side fade into the art, so it ends softly wherever CSS places it.
        ramp = max(round(alpha.width * args.fade_sides), 1)
        fade = Image.new("L", alpha.size, 255)
        for x in range(ramp):
            level = round(255 * (x / ramp) ** 1.5)
            fade.paste(level, (x, 0, x + 1, alpha.height))
            fade.paste(level, (alpha.width - 1 - x, 0, alpha.width - x, alpha.height))
        steps.append(("fade", fade))

    if args.fade_bottom:
        # Thin the foreground into bare paper, so the plate meets the footer strip without an edge.
        ramp = max(round(alpha.height * args.fade_bottom), 1)
        fade = Image.new("L", alpha.size, 255)
        for y in range(ramp):
            fade.paste(round(255 * (y / ramp) ** 1.5), (0, alpha.height - 1 - y, alpha.width, alpha.height - y))
        steps.append(("fade", fade))

    if args.pad_to:
        # Blank paper at both ends, so the plate can bleed off narrow screens without cropping the scene.
        padded = round(alpha.height * args.pad_to)
        if padded > alpha.width:
            steps.append(("pad", ((padded - alpha.width) // 2, padded)))

    return steps


def replay(layer, steps, fades=True):
    for kind, value in steps:
        if kind == "fade" and not fades:
            continue
        if kind == "crop":
            layer = layer.crop(value)
        elif kind == "flip":
            layer = layer.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        elif kind == "fade":
            layer = Image.composite(layer, Image.new("L", layer.size, 0), value)
        elif kind == "pad":
            offset, width = value
            padded = Image.new("L", (width, layer.height), 0)
            padded.paste(layer, (offset, 0))
            layer = padded
    return layer


def move(point, steps):
    """Where a source point lands on the plate (a flip maps x to width - x)."""
    x, y = point
    width = source.width
    for kind, value in steps:
        if kind == "crop":
            x, y, width = x - value[0], y - value[1], value[2] - value[0]
        elif kind == "flip":
            x = width - x
        elif kind == "pad":
            x, width = x + value[0], value[1]
    return x, y


def polygon_mask(size, polygon):
    # Drawn at 4× and scaled down, so the silhouette's edge is anti-aliased.
    big = Image.new("L", (size[0] * 4, size[1] * 4), 0)
    ImageDraw.Draw(big).polygon([(x * 4, y * 4) for x, y in polygon], fill=255)
    return big.resize(size, Image.Resampling.BOX)


def write_webp(image, target):
    with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
        image.save(tmp.name)
        subprocess.run(
            ["cwebp", "-quiet", "-q", str(args.quality), "-alpha_q", str(args.alpha_quality), tmp.name, "-o", str(target)],
            check=True,
        )
    print(target, f"{target.stat().st_size / 1024:.1f} KB")


source = ink_alpha(args.source)
steps = plan(source)
parts = json.loads(Path(args.parts).read_text()) if args.parts else {}

plate_source = ink_alpha(args.plate_source) if args.plate_source else source
if plate_source.size != source.size:
    parser.error("--plate-source must be the same size as the source")
if parts and not args.plate_source:
    for part in parts.values():
        if not part.get("overlay"):
            plate_source = ImageChops.subtract(plate_source, polygon_mask(source.size, part["polygon"]))
alpha = replay(plate_source, steps)

print(f"mask {alpha.width}x{alpha.height} (ratio {alpha.width / alpha.height:.3f})")

out = Path(args.out_dir)
out.mkdir(parents=True, exist_ok=True)
for width in WIDTHS:
    height = round(alpha.height * width / alpha.width)
    ink = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ink.putalpha(alpha.resize((width, height), Image.Resampling.LANCZOS))
    write_webp(ink, out / f"{args.name}-{width}.webp")

manifest = {"plate": [alpha.width, alpha.height], "parts": {}}
for name, part in parts.items():
    region = polygon_mask(source.size, part["polygon"])
    ink = ink_alpha(Path(args.parts).parent / part["art"]) if "art" in part else source
    if ink.size != source.size:
        parser.error(f"{name}'s art must be the same size as the source")
    # An overlay keeps its full ink, so it still shows where the plate has faded.
    part_ink = replay(ImageChops.multiply(ink, region), steps, fades=not part.get("overlay"))
    silhouette = replay(region, steps)
    left, top, right, bottom = silhouette.getbbox()
    part_ink, silhouette = (layer.crop((left, top, right, bottom)) for layer in (part_ink, silhouette))

    # The rest offset, mapped through the flip by moving the cut box's corner.
    dx, dy = part.get("rest", (0, 0))
    corner = move((0, 0), steps)
    moved = move((dx, dy), steps)
    rest_x, rest_y = moved[0] - corner[0], moved[1] - corner[1]
    box = (left + rest_x, top + rest_y, right - left, bottom - top)
    # Left, top, width and height at rest, in % of the plate's width and height.
    entry = {"box": [round(box[0] / alpha.width * 100, 3), round(box[1] / alpha.height * 100, 3),
                     round(box[2] / alpha.width * 100, 3), round(box[3] / alpha.height * 100, 3)]}
    if rest_x or rest_y:
        # Where it was cut, from its rest, in % of its own width and height (a CSS `translate`).
        entry["from"] = [round(-rest_x / box[2] * 100, 2), round(-rest_y / box[3] * 100, 2)]
    manifest["parts"][name] = entry

    for width in WIDTHS:
        scale = width / alpha.width
        size = (max(round(box[2] * scale), 1), max(round(box[3] * scale), 1))
        if part.get("opaque"):
            luminance = part_ink.resize(size, Image.Resampling.LANCZOS)
            image = Image.merge("RGBA", (luminance, luminance, luminance, silhouette.resize(size, Image.Resampling.LANCZOS)))
        else:
            image = Image.new("RGBA", size, (0, 0, 0, 0))
            image.putalpha(part_ink.resize(size, Image.Resampling.LANCZOS))
        write_webp(image, out / f"{args.name}-{name}-{width}.webp")

if args.manifest:
    Path(args.manifest).write_text(json.dumps(manifest, indent=2) + "\n")
    print(args.manifest)
