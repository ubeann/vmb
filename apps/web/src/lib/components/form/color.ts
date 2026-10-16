// A colour as the custom picker moves it (#302): hue, saturation and
// brightness, from and to the `#RRGGBB` a record stores.

/** Hue in degrees (0–360); saturation and brightness from 0 to 1. */
export type Hsv = { h: number; s: number; v: number };

const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = channels(hex) as [number, number, number];
  const max = Math.max(r, g, b);
  const spread = max - Math.min(r, g, b);
  let h = 0;
  if (spread > 0) {
    if (max === r) h = ((g - b) / spread) % 6;
    else if (max === g) h = (b - r) / spread + 2;
    else h = (r - g) / spread + 4;
  }
  h *= 60;
  return { h: h < 0 ? h + 360 : h, s: max === 0 ? 0 : spread / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`.toUpperCase();
}

type Hsl = { h: number; s: number; l: number };

function hexToHsl(hex: string): Hsl {
  const [r, g, b] = channels(hex) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const spread = max - min;
  const s = spread === 0 ? 0 : spread / (1 - Math.abs(2 * l - 1));
  return { h: hexToHsv(hex).h, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  // through HSV, which shares the hue
  const v = l + s * Math.min(l, 1 - l);
  return hsvToHex({ h, s: v === 0 ? 0 : 2 * (1 - l / v), v });
}

/**
 * A colour's contrast against white, as WCAG measures it. A record's tile
 * draws its icon in the colour itself on a faint tint of it, so in the light
 * theme a pale colour fades into its tile; the dark theme lightens the icon
 * and stays readable for any colour.
 */
export function contrastWithWhite(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  ) as [number, number, number];
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

/**
 * Under this the icon all but disappears on a light tile. The seeded
 * swatches clear it (Yellow, the palest, is 2.9:1), so it flags only the
 * pale tints a custom colour can reach, such as #FDE68A at 1.25:1.
 */
export const HARD_TO_SEE_BELOW = 2;

/** What a darker shade is darkened to: WCAG's 3:1 for an icon. */
export const READABLE_AT = 3;

/**
 * The colour's own hue and saturation, darkened step by step until its icon
 * reads on a light tile. Darkening keeps a pale yellow a golden one, where
 * dimming its brightness alone would turn it olive.
 */
export function darkerShade(hex: string): string {
  const hsl = hexToHsl(hex);
  for (let l = hsl.l; l > 0; l -= 0.01) {
    const shade = hslToHex({ ...hsl, l });
    if (contrastWithWhite(shade) >= READABLE_AT) return shade;
  }
  return "#000000";
}
