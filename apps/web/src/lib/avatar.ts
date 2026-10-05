import { Avatar, Style } from "@dicebear/core";
import pixelbot from "@dicebear/styles/pixelbot.json" with { type: "json" };

// The picture of a user with no uploaded photo: a Pixelbot, in two tones. Its
// face comes from DiceBear's seeded random draw, its colours from the pair the
// seed picks here, so a person keeps both across themes. The dark theme gets a
// deep ground with a bright glow, the light theme a mid-deep one with a pale
// glow, so the bot reads as a solid chip on paper; each pair holds 6:1 or
// better. DiceBear's Pixelbot is CC0, and it runs on our server, so no user id
// goes to a third-party avatar service. The fills sit in an SVG, outside the
// CSS token system.
const TONES = [
  { dark: ["0f1a4d", "86efac"], light: ["166534", "bbf7d0"] },
  { dark: ["052e24", "5eead4"], light: ["115e59", "99f6e4"] },
  { dark: ["1e1b4b", "c4b5fd"], light: ["3730a3", "c7d2fe"] },
  { dark: ["3b0764", "f9a8d4"], light: ["86198f", "f5d0fe"] },
  { dark: ["431407", "fdba74"], light: ["9a3412", "fed7aa"] },
  { dark: ["0c2a4a", "7dd3fc"], light: ["075985", "bae6fd"] },
  { dark: ["14301a", "bef264"], light: ["3f6212", "d9f99d"] },
  { dark: ["4a0d2b", "fda4af"], light: ["9f1239", "fecdd3"] }
] as const;

const style = new Style(pixelbot);

export type AvatarTheme = "light" | "dark";

// FNV-1a, to pick a colour pair from the seed.
function toneIndex(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 0x01000193);
  }
  return (hash >>> 0) % TONES.length;
}

// `animated` adds a slow blink and smile. The SVG's own stylesheet only plays
// it under `prefers-reduced-motion: no-preference`.
export function avatarSvg(
  seed: string,
  { theme, animated = false }: { theme: AvatarTheme; animated?: boolean }
): string {
  const [background, glow] = TONES[toneIndex(seed)]![theme];
  return new Avatar(style, {
    seed,
    backgroundColor: [background],
    glowColor: [glow],
    animationVariant: [animated ? "slow" : "none"]
  }).toString();
}
