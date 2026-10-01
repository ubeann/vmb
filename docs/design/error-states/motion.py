#!/usr/bin/env python3
"""Prepare the error vignettes' moving parts (#244), after the auth plates' (#243).

Each vignette is a 1216 × 896 source in `sources/`. Its moving parts leave holes
in it, which Recraft fills, and come back as new Recraft art set where the old
part stood:

- `patches` crops a patch of each source around its holes and draws the mask
  (white is erased) for Recraft's `erase_region`.
- `paste` sets each filled patch back into its source inside the mask Recraft
  was sent (the saved file), softened at the edge, and writes `<scene>-filled.png`,
  which prepare-etching.py takes as `--plate-source`.
- `art` scales, rotates and sets each generated image on a canvas the size of
  the source, and writes `<scene>-parts.json` for prepare-etching.py's `--parts`:
  an opaque part's silhouette is the convex hull of its ink, a part drawn over
  the plate (the gate's leaves) gets a box, and a part cut from the source (the
  lock) keeps the polygon traced here.

Usage: motion.py patches | paste | art
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = Path(__file__).parent
SOURCES = HERE / "sources"
MOTION = SOURCES / "motion"
FILL = MOTION / "fill"
SIZE = (1216, 896)

SCENES = {
    "road": {"source": "road-1-1216.jpg"},
    "gate": {"source": "gate-2-1216.jpg"},
    "crates": {"source": "crates-1-1216.jpg"},
}

# What each part leaves behind, traced on the source in its pixels.
HOLES = {
    "road": {
        "patch": (300, 360, 812, 872),
        "parts": {
            "truck": [
                (474, 479), (630, 484), (631, 555), (618, 556), (618, 588), (600, 598), (520, 601),
                (470, 601), (440, 590), (436, 572), (436, 538), (433, 520), (436, 517), (444, 512),
                (462, 508), (474, 505),
            ],
        },
    },
    "gate": {
        "patch": (330, 230, 842, 742),
        "parts": {
            "leaf-left": [
                (424, 334), (433, 324), (457, 314), (480, 308), (504, 300), (528, 291), (553, 282),
                (576, 277), (594, 272), (598, 270), (603, 272), (603, 640), (596, 642), (560, 628),
                (424, 628),
            ],
            "leaf-right": [
                (603, 272), (607, 274), (621, 288), (645, 295), (667, 303), (691, 310), (715, 318),
                (740, 322), (763, 330), (772, 336), (772, 628), (603, 640),
            ],
            "lock": [
                (540, 430), (556, 432), (582, 448), (596, 456), (612, 462), (620, 466), (630, 480),
                (632, 508), (608, 508), (606, 490), (596, 478), (580, 470), (560, 455), (545, 444),
            ],
        },
    },
    "crates": {
        "patch": (360, 250, 872, 762),
        "parts": {
            "stack": [
                (550, 263), (626, 261), (681, 287), (682, 291), (668, 345), (657, 368), (646, 388),
                (643, 460), (640, 500), (636, 518), (585, 535), (570, 533), (560, 505), (528, 482),
                (516, 452), (522, 380), (542, 295), (549, 280),
            ],
            "crate": [
                (420, 520), (432, 517), (500, 470), (520, 472), (558, 488), (562, 498), (555, 512),
                (528, 535), (490, 578), (480, 580), (440, 560), (422, 540),
            ],
        },
    },
}

GROW = 4  # px the holes are grown by

# The generated art, set on the source's canvas. `target` is where it goes, in the
# source's pixels: `box` stretches the art's ink to a box, `bottom` scales it to
# `width` and stands it on that point. `pivot` (the ink's bottom centre unless
# given) is the point it is rotated about by `angle` degrees clockwise, and the
# point CSS rotates about when the part moves.
ART = {
    "road": {
        "truck": {"art": "truck-2.png", "opaque": True, "width": 205, "bottom": (532, 601)},
    },
    "gate": {
        "leaf-left": {"art": "leaf-1.png", "box": (424, 272, 604, 642)},
        "leaf-right": {"art": "leaf-1.png", "mirror": True, "box": (598, 272, 772, 642)},
    },
    "crates": {
        "stack": {"art": "stack-1.png", "opaque": True, "height": 275, "bottom": (580, 528), "angle": 9},
        "crate": {"art": "crate-1.png", "opaque": True, "width": 128, "bottom": (494, 572), "angle": -16},
    },
}


def polygon_mask(polygon, size=SIZE):
    # Drawn at 4× and scaled down, so the edge is anti-aliased.
    big = Image.new("L", (size[0] * 4, size[1] * 4), 0)
    ImageDraw.Draw(big).polygon([(x * 4, y * 4) for x, y in polygon], fill=255)
    return big.resize(size, Image.Resampling.BOX)


def hole_mask(scene):
    """The scene's hole, full size: the parts' outlines, grown."""
    outline = Image.new("L", SIZE, 0)
    for polygon in HOLES[scene]["parts"].values():
        outline = ImageChops.lighter(outline, polygon_mask(polygon))
    return outline.filter(ImageFilter.MaxFilter(GROW * 2 + 1)).point(lambda v: 255 if v > 64 else 0)


def patches():
    FILL.mkdir(parents=True, exist_ok=True)
    for scene, config in HOLES.items():
        source = Image.open(SOURCES / SCENES[scene]["source"]).convert("RGB")
        box = config["patch"]
        source.crop(box).save(FILL / f"{scene}-input.png")
        hole_mask(scene).crop(box).save(FILL / f"{scene}-mask.png")
        print(FILL / f"{scene}-input.png", FILL / f"{scene}-mask.png")


def paste():
    """Set Recraft's fills back, or, where there is none yet, bare paper (a stand-in that ships nowhere)."""
    for scene, config in HOLES.items():
        x0, y0, x1, y1 = config["patch"]
        filled = Image.open(SOURCES / SCENES[scene]["source"]).convert("L")
        sent = Image.open(FILL / f"{scene}-mask.png").convert("L").filter(ImageFilter.GaussianBlur(1))
        result_path = FILL / f"{scene}-result.png"
        if result_path.exists():
            result = Image.open(result_path).convert("L").resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS)
        else:
            print(f"{scene}: no Recraft result yet, filling with paper")
            result = Image.new("L", (x1 - x0, y1 - y0), 255)
        filled.paste(result, (x0, y0), sent)
        target = SOURCES / f"{scene}-filled.png"
        filled.save(target, optimize=True)
        print(target)


def ink_points(canvas, level=170):
    ys, xs = np.nonzero(np.asarray(canvas) < level)
    return xs, ys


def ink_box(canvas, level=170, specks=3):
    """The box around a generated image's ink, ignoring the stray specks Recraft leaves on the paper."""
    ink = np.asarray(canvas) < level
    cols, rows = np.nonzero(ink.sum(axis=0) >= specks)[0], np.nonzero(ink.sum(axis=1) >= specks)[0]
    return int(cols.min()), int(rows.min()), int(cols.max()) + 1, int(rows.max()) + 1


def hull(points):
    """Convex hull (monotone chain) of (x, y) points."""
    points = sorted(set(points))

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2 and (out[-1][0] - out[-2][0]) * (p[1] - out[-2][1]) - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0]) <= 0:
                out.pop()
            out.append(p)
        return out

    lower, upper = half(points), half(reversed(points))
    return lower[:-1] + upper[:-1]


def place(config):
    """The generated art on a white source-sized canvas, and its pivot on that canvas."""
    art = Image.open(MOTION / config["art"]).convert("L")
    if config.get("mirror"):
        art = art.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    art = art.crop(ink_box(art))
    if "box" in config:
        left, top, right, bottom = config["box"]
        piece = art.resize((right - left, bottom - top), Image.Resampling.LANCZOS)
        at = (left, top)
    else:
        scale = config["width"] / art.width if "width" in config else config["height"] / art.height
        piece = art.resize((round(art.width * scale), round(art.height * scale)), Image.Resampling.LANCZOS)
        at = (round(config["bottom"][0] - piece.width / 2), config["bottom"][1] - piece.height)
    canvas = Image.new("L", SIZE, 255)
    canvas.paste(piece, at)
    pivot = (at[0] + piece.width / 2, at[1] + piece.height)
    if config.get("angle"):
        canvas = canvas.rotate(-config["angle"], center=pivot, resample=Image.Resampling.BICUBIC, fillcolor=255)
    return canvas, pivot


def art():
    for scene, parts in ART.items():
        out = {}
        for name, config in parts.items():
            canvas, pivot = place(config)
            canvas.save(MOTION / f"{scene}-{name}-art.png", optimize=True)
            if config.get("opaque"):
                xs, ys = ink_points(canvas, level=200)
                polygon = hull(list(zip(xs[::2].tolist(), ys[::2].tolist())))
            else:
                left, top, right, bottom = config["box"]
                polygon = [(left - 3, top - 3), (right + 3, top - 3), (right + 3, bottom + 3), (left - 3, bottom + 3)]
            width, height = max(p[0] for p in polygon) - min(p[0] for p in polygon), max(p[1] for p in polygon) - min(p[1] for p in polygon)
            entry = {
                "art": f"sources/motion/{scene}-{name}-art.png",
                "polygon": [[int(x), int(y)] for x, y in polygon],
            }
            if config.get("opaque"):
                entry["opaque"] = True
            if config.get("angle"):
                # Where CSS rotates the part about, in % of its own box.
                entry["origin"] = [
                    round((pivot[0] - min(p[0] for p in polygon)) / width * 100, 1),
                    round((pivot[1] - min(p[1] for p in polygon)) / height * 100, 1),
                ]
            out[name] = entry
        for name, polygon in HOLES.get(scene, {}).get("parts", {}).items():
            # A part cut from the source (the gate's lock) keeps its traced outline.
            if name == "lock":
                out[name] = {"polygon": [list(p) for p in polygon]}
        target = HERE / f"{scene}-parts.json"
        target.write_text(json.dumps(out, indent=2) + "\n")
        print(target)


if __name__ == "__main__":
    commands = {"patches": patches, "paste": paste, "art": art}
    if sys.argv[1:] and sys.argv[1] in commands and len(sys.argv) == 2:
        commands[sys.argv[1]]()
    else:
        sys.exit(__doc__)
