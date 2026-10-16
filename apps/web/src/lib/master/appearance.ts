// How a Division or a Role looks in the lists (#302, #303): the colours their
// forms offer, and the code a Division's suggests from a name.

/** The seeded Divisions' own colours, which the form offers as swatches. */
export const SWATCHES = [
  { label: "Blue", hex: "#2563EB" },
  { label: "Cyan", hex: "#0891B2" },
  { label: "Teal", hex: "#0D9488" },
  { label: "Green", hex: "#16A34A" },
  { label: "Yellow", hex: "#CA8A04" },
  { label: "Orange", hex: "#EA580C" },
  { label: "Red", hex: "#DC2626" },
  { label: "Pink", hex: "#DB2777" },
  { label: "Purple", hex: "#9333EA" },
  { label: "Violet", hex: "#7C3AED" },
  { label: "Slate", hex: "#64748B" },
  { label: "Gray", hex: "#4B5563" }
] as const;

/** Where a new Division's colour starts: a swatch, not the schema's black. */
export const DEFAULT_COLOR = SWATCHES[0].hex;

/** The fields a Division's and a Role's form share for how the record looks. */
export type AppearanceValues = { name: string; colorHex: string; iconName: string };

const HEX = /^#[0-9a-fA-F]{6}$/;

/** A colour as the swatches and the tile show it: upper case once it is a whole hex, else none. */
export function pickedColor(hex: string): string | null {
  return HEX.test(hex) ? hex.toUpperCase() : null;
}

/** What a Division's form holds right now, for a header that shows it as it is typed. */
export type DivisionDraft = {
  name: string;
  code: string;
  colorHex: string;
  iconName: string;
  /** Edits the form would lose if it closed now. */
  dirty: boolean;
};

/** What a Role's form holds right now, as a Division's does without the code. */
export type RoleDraft = Omit<DivisionDraft, "code">;

/** The tile's colour while the typed hex is not yet a whole one. */
export const PENDING_COLOR = "#64748B";

const MINOR = new Set(["AND", "OF", "THE"]);

/**
 * A code for a name, as the seeded ones are made: the first three letters of
 * one word ("Finance" → FIN), the initials of three or more ("Health, Safety &
 * Environment" → HSE), and for two the initials and the next letter of the
 * second (Quality Assurance → QAS). Only a suggestion, which the person edits.
 */
export function suggestCode(name: string): string {
  const words = (name.toUpperCase().match(/[A-Z0-9]+/g) ?? []).filter((word) => !MINOR.has(word));
  if (words.length === 0) return "";
  if (words.length === 1) return words[0]!.slice(0, 3);
  if (words.length === 2) return `${words[0]![0]}${words[1]!.slice(0, 2)}`;
  return words
    .map((word) => word[0])
    .join("")
    .slice(0, 5);
}
