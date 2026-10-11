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
export const ROW_CLASS = "cursor-pointer transition-none hover:bg-muted has-aria-expanded:bg-muted";

/** A pinned cell follows every state that paints its row, the open menu included. */
export const PINNED_BG_CLASS =
  "bg-card [tr:hover>&]:bg-muted [tr:has([aria-expanded=true])>&]:bg-muted";

/** A row action lifts on hover to the page colour with a hairline, so it stands out from the hovered row. */
export const ROW_ACTION_CLASS =
  "hover:bg-background dark:hover:bg-background hover:ring-border hover:text-foreground hover:shadow-xs hover:ring-1";

/** The ⋮ trigger stays lit while its menu is open. */
export const ROW_MENU_TRIGGER_CLASS =
  "data-[state=open]:bg-background data-[state=open]:ring-ring/50 data-[state=open]:ring-[3px]";

/** Menu items carry a muted icon, except the destructive one. */
export const ROW_MENU_CLASS =
  "[&_[data-slot=dropdown-menu-item]:not([data-variant=destructive])_svg]:text-muted-foreground w-48";

/** Whether a click on a row, rather than on something inside it, should open the record. */
export function opensRecord(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  // a modified click belongs to the name link, which the browser opens in a new tab or window
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (!(event.target instanceof Element)) return false;
  if (event.target.closest("a, button, input, label, [role='menuitem']")) return false;
  // dragging across a row to copy a code is not a click on it
  return window.getSelection()?.isCollapsed !== false;
}
