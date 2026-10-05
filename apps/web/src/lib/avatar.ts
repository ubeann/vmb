import { Avatar, Style } from "@dicebear/core";
import initials from "@dicebear/styles/initials.json" with { type: "json" };

// The placeholder for a user with no uploaded photo: their initials on a
// colour picked from their name, so the same person looks the same everywhere.
// DiceBear's `initials` style is CC0, and it runs here, so no name is sent to a
// third-party avatar service. The fills sit in an SVG data URI, outside the CSS
// token system; each holds 4.5:1 against the white initials in both themes.
const PALETTE = ["1d2a73", "2f7a3a", "1f6f78", "4a3a8c", "8a4b1d", "9b3d52", "3b4a6b", "5a7d1f"];

const style = new Style(initials);

export function placeholderAvatar(name: string): string {
  return new Avatar(style, {
    seed: name,
    size: 96,
    backgroundColor: PALETTE,
    textColor: ["ffffff"],
    fontFamily: ["Inter, system-ui, sans-serif"],
    fontWeight: [600]
  }).toDataUri();
}
