#!/usr/bin/env python3
"""Fill the holes the landscape's moving parts leave in the approved master (#243).

`patches` crops each patch of the master and draws its mask (the parts'
polygons, grown by a few pixels; white is filled) for Recraft's `erase_region`.
`paste` sets each filled patch back into the master inside its mask, softened
at the edge, and writes the filled master that prepare-etching.py takes as
`--plate-source`. Everything outside the masks keeps the master's pixels.

Usage: fill-holes.py patches
       fill-holes.py paste
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).parent
MASTER = HERE / "../etched-login/sources/landscape-a1-4096.jpg"
FILLED = HERE / "sources/landscape-a1-4096-filled.png"
FILL = HERE / "sources/fill"
PARTS = json.loads((HERE / "landscape-parts.json").read_text())

# Recraft gets a patch around the holes, not the 4096px master: its results
# come back at most 1536px wide.
PATCHES = {
    "trucks": {"box": (1600, 1240, 3136, 1752), "parts": ["truck-1", "truck-2", "truck-3"]},
    "container": {"box": (2864, 860, 3376, 1372), "parts": ["container"]},
}
GROW = 6


def mask(patch):
    x0, y0, x1, y1 = patch["box"]
    image = Image.new("L", (x1 - x0, y1 - y0), 0)
    for name in patch["parts"]:
        ImageDraw.Draw(image).polygon([(x - x0, y - y0) for x, y in PARTS[name]["polygon"]], fill=255)
    return image.filter(ImageFilter.MaxFilter(GROW * 2 + 1))


master = Image.open(MASTER).convert("L")
FILL.mkdir(parents=True, exist_ok=True)

if sys.argv[1:] == ["patches"]:
    for name, patch in PATCHES.items():
        master.crop(patch["box"]).convert("RGB").save(FILL / f"{name}-input.png")
        mask(patch).save(FILL / f"{name}-mask.png")
        print(FILL / f"{name}-input.png", FILL / f"{name}-mask.png")
elif sys.argv[1:] == ["paste"]:
    filled = master.copy()
    for name, patch in PATCHES.items():
        x0, y0, x1, y1 = patch["box"]
        result = Image.open(FILL / f"{name}-result.png").convert("L").resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS)
        filled.paste(result, (x0, y0), mask(patch).filter(ImageFilter.GaussianBlur(2)))
    filled.save(FILLED, optimize=True)
    print(FILLED, f"{FILLED.stat().st_size / 1024:.0f} KB")
else:
    sys.exit(__doc__)
