// Legacy rows store Filament's Heroicons names (`heroicon-o-truck`). The UI
// draws Lucide only, so each known name maps to its closest Lucide glyph and
// anything unmapped falls back to a neutral one rather than rendering nothing.
const LUCIDE_BY_HEROICON = {
  banknotes: "banknote",
  "building-office": "building",
  "building-office-2": "building-2",
  "clipboard-document-check": "clipboard-check",
  cog: "cog",
  "cog-6-tooth": "settings",
  "computer-desktop": "monitor",
  cube: "box",
  home: "house",
  megaphone: "megaphone",
  "rocket-launch": "rocket",
  scale: "scale",
  "shield-check": "shield-check",
  "shopping-cart": "shopping-cart",
  truck: "truck",
  user: "user",
  "user-group": "users"
} as const;

export const FALLBACK_ICON = "shapes";

export type LucideIconKey =
  (typeof LUCIDE_BY_HEROICON)[keyof typeof LUCIDE_BY_HEROICON] | typeof FALLBACK_ICON;

const HEROICON_NAME = /^heroicon-[a-z]-(.+)$/;

export function heroiconToLucide(name: string): LucideIconKey {
  const glyph = HEROICON_NAME.exec(name)?.[1];
  if (glyph && Object.hasOwn(LUCIDE_BY_HEROICON, glyph)) {
    return LUCIDE_BY_HEROICON[glyph as keyof typeof LUCIDE_BY_HEROICON];
  }
  return FALLBACK_ICON;
}
