#!/usr/bin/env python3
"""Turn a black-ink-on-paper engraving into the login page's ink mask.

The page draws the etching with CSS `mask-image`, filled with the `--etching`
token, so the source only needs to say *where* ink is: this writes black RGB
with the ink density in the alpha channel. Paper becomes transparent, so the
same file works on the light paper and the dark navy scheme.

Usage: prepare-etching.py <source.png> <out-dir> [--white 212] [--black 40]

Writes vmb-etching-2400.webp and vmb-etching-1200.webp (needs `cwebp`).
"""

import argparse
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("source")
parser.add_argument("out_dir")
parser.add_argument("--white", type=int, default=212, help="luminance treated as bare paper")
parser.add_argument("--black", type=int, default=40, help="luminance treated as full ink")
parser.add_argument("--quality", type=int, default=60)
parser.add_argument("--alpha-quality", type=int, default=50)
args = parser.parse_args()

gray = Image.open(args.source).convert("L")
span = max(args.white - args.black, 1)
alpha = gray.point(lambda v: 0 if v >= args.white else 255 if v <= args.black else round((args.white - v) / span * 255))

out = Path(args.out_dir)
out.mkdir(parents=True, exist_ok=True)
for width in (2400, 1200):
    height = round(alpha.height * width / alpha.width)
    ink = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ink.putalpha(alpha.resize((width, height), Image.Resampling.LANCZOS))
    with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
        ink.save(tmp.name)
        target = out / f"vmb-etching-{width}.webp"
        subprocess.run(
            ["cwebp", "-quiet", "-q", str(args.quality), "-alpha_q", str(args.alpha_quality), tmp.name, "-o", str(target)],
            check=True,
        )
        print(target, f"{target.stat().st_size / 1024:.0f} KB")
