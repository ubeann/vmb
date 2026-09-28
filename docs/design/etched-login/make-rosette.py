#!/usr/bin/env python3
"""Draw the auth sheet's guilloché rosette as a stroked SVG.

Banknote rosettes are bands of phase-shifted wavy rings, the pattern a rose
engine cuts. Each ring is r(θ) = R + A·sin(kθ + φ); neighbouring rings shift φ
so the waves interlace. The SVG is used as a CSS mask (filled with the
`--etching` token), so it only carries geometry: black strokes, no fill.

Usage: make-rosette.py <out.svg>
"""

import math
import sys

SIZE = 1000
CENTER = SIZE / 2
STEPS = 288  # points per ring; smooth at the ~36rem it is drawn at


def ring(radius: float, amplitude: float, lobes: int, phase: float) -> str:
    points = []
    for i in range(STEPS):
        theta = 2 * math.pi * i / STEPS
        r = radius + amplitude * math.sin(lobes * theta + phase)
        points.append(f"{CENTER + r * math.cos(theta):.0f} {CENTER + r * math.sin(theta):.0f}")
    return "M" + "L".join(points) + "Z"


def band(inner: float, outer: float, count: int, amplitude: float, lobes: int, twist: float) -> list[str]:
    return [
        ring(inner + (outer - inner) * i / (count - 1), amplitude, lobes, twist * i)
        for i in range(count)
    ]


paths = [
    # outer lace: many fine rings with a slow twist, the dominant texture
    *band(360, 470, 13, 22, 36, math.pi / 7),
    # middle rosette: fewer, deeper lobes
    *band(220, 330, 9, 34, 18, math.pi / 5),
    # inner medallion
    *band(90, 190, 7, 18, 12, math.pi / 4),
]
# plain rules framing each band, as on a certificate seal
rules = "".join(f'<circle cx="{CENTER:.0f}" cy="{CENTER:.0f}" r="{r}"/>' for r in (78, 205, 345, 489))

svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" '
    'fill="none" stroke="#000" stroke-linejoin="round">'
    f'<path stroke-width="1.1" d="{"".join(paths)}"/>'
    f'<g stroke-width="1.6">{rules}</g>'
    "</svg>"
)

with open(sys.argv[1], "w") as out:
    out.write(svg)
print(sys.argv[1], f"{len(svg) / 1024:.0f} KB")
