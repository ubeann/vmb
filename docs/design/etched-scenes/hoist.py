#!/usr/bin/env python3
"""Set the generated container and its ropes on canvases the size of the landscape master (#243).

The container cut from the plate rested on the stacks with CSS lines for
cables, which read as a different hand from the engraving. Recraft drew a
container hanging on two wire ropes (`sources/hoist/container-2.png`). This
scales it so the container body has the cut container's width, and writes two
canvases in the master's pixels for prepare-etching.py's per-part "art":

- the container body, where the cut container was (it is lowered from there);
- a length of rope, from the boom's underside to the container's resting top.

Usage: hoist.py
"""

import json
from pathlib import Path

from PIL import Image, ImageFilter

HERE = Path(__file__).parent
ART = HERE / "sources/hoist/container-2.png"
OUT = HERE / "sources/hoist"
PARTS = json.loads((HERE / "landscape-parts.json").read_text())
MASTER_SIZE = (4096, 2048)

# The generated image: the container body's box, and the ropes above it.
BODY = (92, 1291, 680, 1493)
# The landscape master: the boom's underside, where the ropes hang from.
BOOM = 1084

art = Image.open(ART).convert("L")
xs = [x for x, _ in PARTS["container"]["polygon"]]
ys = [y for _, y in PARTS["container"]["polygon"]]
left, top = min(xs), min(ys)
scale = (max(xs) - left) / (BODY[2] - BODY[0])
rest_top = top + PARTS["container"]["rest"][1]


def place(region, at, grow=0):
    """Scale a region of the generated image (its ink grown by `grow` pixels first) onto a white master-sized canvas."""
    piece = art.crop(region)
    if grow:
        piece = piece.filter(ImageFilter.MinFilter(grow * 2 + 1))
    piece = piece.resize((round(piece.width * scale), round(piece.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("L", MASTER_SIZE, 255)
    canvas.paste(piece, at)
    return canvas


place(BODY, (left, top)).save(OUT / "container-art.png", optimize=True)

# The rope just above the body, as long as the drop from the boom to the resting top.
# Each rope is two hairline strands about 15px apart, which scale down to almost
# nothing; growing their ink by 5px merges them into one rope of about 2px on the
# desktop plate.
rope_length = round((rest_top - BOOM) / scale)
place((BODY[0] - 10, BODY[1] - rope_length, BODY[2] + 10, BODY[1]), (left - round(10 * scale), BOOM), grow=5).save(
    OUT / "ropes-art.png", optimize=True
)
print(f"scale {scale:.4f}, ropes {BOOM}–{rest_top}")
