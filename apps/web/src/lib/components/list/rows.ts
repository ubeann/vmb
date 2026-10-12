/**
 * What every list row shares (ADR-0051 rules 7 and 8), so Divisions, Roles and
 * Users read the same and none copies the classes.
 */

/**
 * A row opens its record on click. Its background must change in one frame: the
 * row's own `transition-colors` faded in over 150ms while the pinned cells,
 * painted separately, switched at once, so the middle lagged the edges. So no
 * fade, and a row whose menu is open keeps the hover colour.
 */
export const ROW_CLASS =
  "cursor-pointer transition-none hover:bg-muted has-aria-expanded:bg-muted data-marked:bg-muted";

/** A pinned cell follows every state that paints its row, the open menu included. */
export const PINNED_BG_CLASS =
  "bg-card [tr:hover>&]:bg-muted [tr:has([aria-expanded=true])>&]:bg-muted [tr[data-marked]>&]:bg-muted";

/** The keyboard's row (ADR-0052 rule 4) gets a green bar on its leading edge; put it on the name cell. */
export const ROW_MARK_CLASS =
  "before:bg-primary before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:opacity-0 [tr[data-marked]>&]:before:opacity-100";

/** A row action lifts on hover to the page colour with a hairline, so it stands out from the hovered row. */
export const ROW_ACTION_CLASS =
  "hover:bg-background dark:hover:bg-background hover:ring-border hover:text-foreground hover:shadow-xs hover:ring-1";

/** The ⋮ trigger stays lit while its menu is open. */
export const ROW_MENU_TRIGGER_CLASS =
  "data-[state=open]:bg-background data-[state=open]:ring-ring/50 data-[state=open]:ring-[3px]";

/**
 * Menu items carry a muted icon, except the destructive one. The menu box takes no
 * focus ring when it opens from the keyboard: the focused item shows it.
 */
export const ROW_MENU_CLASS =
  "[&_[data-slot=dropdown-menu-item]:not([data-variant=destructive])_svg]:text-muted-foreground w-48 outline-none";

/**
 * What a row folds to as its card narrows (ADR-0051 rules 7 and 11). The lines
 * sit under the name in the identity cell and show only in their band; the
 * columns they stand in for hide through `columnClass`.
 *
 * - `TEXT_LINE`: the free text, from 32rem to 42rem of card.
 * - `META_LINE`: "CBK · Updated 5 Jan 2026" under 32rem, cut short with an ellipsis.
 *   An inactive row leads it with "Inactive".
 */
export const TEXT_LINE =
  "text-muted-foreground hidden truncate text-sm @lg/list:@max-2xl/list:block";
export const META_LINE = "text-muted-foreground hidden truncate text-xs @max-lg/list:block";

/**
 * An inactive row under 32rem: the pill goes (the word leads the second line), the
 * tile greys and the name mutes. On a wider card the pill alone says it.
 */
export const INACTIVE_PILL_CLASS = "@max-lg/list:hidden";
export const INACTIVE_TILE_CLASS = "@max-lg/list:opacity-55 @max-lg/list:grayscale";
export const INACTIVE_NAME_CLASS = "@max-lg/list:text-muted-foreground";

/** Whether a click on a row, rather than on something inside it, should open the record. */
export function opensRecord(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  // a modified click belongs to the name link, which the browser opens in a new tab or window
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (!(event.target instanceof Element)) return false;
  if (event.target.closest("a, button, input, label, [role='menuitem']")) return false;
  // dragging across this row to copy a code is not a click on it; a selection elsewhere is
  const selection = window.getSelection();
  const row = event.currentTarget;
  const selectingHere =
    selection &&
    !selection.isCollapsed &&
    row instanceof Node &&
    row.contains(selection.anchorNode);
  return !selectingHere;
}
