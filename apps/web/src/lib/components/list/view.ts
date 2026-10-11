// The rules behind the View panel (ADR-0051 rule 6), kept apart from the
// component so they can be checked without a browser.
import { DEFAULT_PER_PAGE } from "@vmb/types";

export type SortDirection = "asc" | "desc";

/** A column the View panel can sort by once rows fold, and the words for each direction. */
export type SortField = {
  /** The `sort` parameter's value. */
  readonly sort: string;
  readonly label: string;
  /** The direction a column starts in: A to Z for text, newest first for dates. */
  readonly start: SortDirection;
  readonly asc: string;
  readonly desc: string;
};

export type ListSort = { readonly sort: string; readonly dir: SortDirection };

/** Text columns read A to Z, as the header's arrow does. */
export const TEXT_ORDER = { start: "asc", asc: "A to Z", desc: "Z to A" } as const;
/** Date columns start with the latest. */
export const DATE_ORDER = { start: "desc", asc: "Oldest first", desc: "Newest first" } as const;

/** Under this many rem of card, rows fold to two lines and sorting moves into View (ADR-0051 rule 11). */
export const FOLD_BELOW_REM = 32;

/** Whether a card `width` px wide has folded its rows, at the root font size `rem` px. */
export const foldsAt = (width: number, rem = 16): boolean =>
  width > 0 && width < FOLD_BELOW_REM * rem;

/** The order choices of a field, its starting direction first. */
export function orderChoices(field: SortField): { dir: SortDirection; label: string }[] {
  const choices = [
    { dir: "asc", label: field.asc },
    { dir: "desc", label: field.desc }
  ] as const;
  return field.start === "asc" ? [...choices] : [...choices].reverse();
}

/**
 * The URL changes a sort choice makes: each parameter that equals the list's
 * default is dropped, so the link stays the canonical one.
 */
export function sortChanges(choice: ListSort, defaults: ListSort) {
  return {
    sort: choice.sort === defaults.sort ? null : choice.sort,
    dir: choice.dir === defaults.dir ? null : choice.dir
  };
}

/** Where picking another field starts: its natural order. */
export function pickField(field: SortField): ListSort {
  return { sort: field.sort, dir: field.start };
}

/** Whether a sort is not the list's default. */
export const sortDiffers = (sort: ListSort, defaults: ListSort): boolean =>
  sort.sort !== defaults.sort || sort.dir !== defaults.dir;

/** Whether the page size or, once folded, the sort differ from the defaults. */
export function viewDiffers(input: {
  columnsChanged: boolean;
  perPage: number;
  sort: ListSort;
  defaults: ListSort;
  folded: boolean;
}): boolean {
  return (
    input.columnsChanged ||
    input.perPage !== DEFAULT_PER_PAGE ||
    (input.folded && sortDiffers(input.sort, input.defaults))
  );
}
