// Legacy rows store Filament's Heroicons names (`heroicon-o-truck`); a row
// saved since stores the Lucide name it was given from the catalogue (#176
// rewrites the rest). The UI draws Lucide only, so each known Heroicons name
// maps to its closest Lucide glyph and anything unmapped falls back to a
// neutral one rather than rendering nothing.
import { catalogIcon, type IconName } from "./icons/catalog.js";

const LUCIDE_BY_HEROICON = {
  banknotes: "banknote",
  briefcase: "briefcase",
  "building-office": "building",
  "building-office-2": "building-2",
  "clipboard-document-check": "clipboard-check",
  "code-bracket": "code",
  cog: "cog",
  "cog-6-tooth": "settings",
  "computer-desktop": "monitor",
  cube: "box",
  "currency-dollar": "circle-dollar-sign",
  home: "house",
  megaphone: "megaphone",
  "rocket-launch": "rocket",
  scale: "scale",
  "shield-check": "shield-check",
  "shopping-cart": "shopping-cart",
  truck: "truck",
  user: "user",
  "user-group": "users"
} as const satisfies Record<string, IconName>;

export const FALLBACK_ICON = "shapes";

export type LucideIconKey =
  (typeof LUCIDE_BY_HEROICON)[keyof typeof LUCIDE_BY_HEROICON] | typeof FALLBACK_ICON;

const HEROICON_NAME = /^heroicon-[a-z]-(.+)$/;

/**
 * The catalogue icon a stored name draws: a Lucide name (#176) as it is, a
 * legacy Heroicons name through the map, and null for one it can't draw,
 * which shows the fallback.
 */
export function resolveIcon(stored: string): IconName | null {
  if (catalogIcon(stored)) return stored as IconName;
  const lucide = heroiconToLucide(stored);
  return lucide === FALLBACK_ICON ? null : lucide;
}

/** What a person calls the icon a row stores: its catalogue label, else the stored name itself. */
export function iconLabel(stored: string): string {
  const name = resolveIcon(stored);
  return (name && catalogIcon(name)?.label) ?? stored;
}

export function heroiconToLucide(name: string): LucideIconKey {
  const glyph = HEROICON_NAME.exec(name)?.[1];
  if (glyph && Object.hasOwn(LUCIDE_BY_HEROICON, glyph)) {
    return LUCIDE_BY_HEROICON[glyph as keyof typeof LUCIDE_BY_HEROICON];
  }
  return FALLBACK_ICON;
}
