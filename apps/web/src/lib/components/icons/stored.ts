// A record stores the Lucide name of a catalogue icon (#176); migration 0032
// rewrote the legacy Heroicons names to them. A name the migration had no
// icon for, or any other stray value, draws a neutral fallback rather than
// nothing, and the form asks for an icon when the record is next saved.
import { catalogIcon, type IconName } from "./catalog.js";

export const FALLBACK_ICON = "shapes";

/** The catalogue icon a stored name draws, or null for one it can't, which shows the fallback. */
export function resolveIcon(stored: string): IconName | null {
  return catalogIcon(stored)?.name ?? null;
}

/** What a person calls the icon a row stores: its catalogue label, or a note that it has none. */
export function iconLabel(stored: string): string {
  return catalogIcon(stored)?.label ?? "Not in the icon list";
}
