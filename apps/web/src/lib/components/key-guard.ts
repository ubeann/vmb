/**
 * Whether a key press belongs to something else: a field being typed in, a widget that
 * keeps its own keys, or a layer (dialog, menu, panel) laid over the page. Shortcut keys
 * (ADR-0052) stay out of all three.
 */

const OWN_KEYS =
  "input, textarea, select, [contenteditable='true'], [role='textbox'], [role='combobox'], " +
  "[role='listbox'], [role='menu'], [role='menuitem'], [role='tab'], [role='radio'], " +
  "[role='slider'], [role='dialog']";

const LAYERS = "[role='dialog'], [role='menu'], [role='listbox'], [data-slot='popover-content']";

/** Whether the key was pressed inside a field or widget that uses it itself. */
function inOwnWidget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(OWN_KEYS) !== null;
}

/** Whether a dialog, menu or panel is open; one still closing doesn't count. */
function layerOpen(): boolean {
  return [...document.querySelectorAll(LAYERS)].some(
    (layer) => layer.getAttribute("data-state") !== "closed"
  );
}

/** Whether a modifier is held, which makes it the browser's or the app's own shortcut, not a bare key. */
export function modified(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey;
}

/** Whether a plain shortcut key (`?`, a row's keys) should be left alone for this event. */
export function shouldIgnore(event: KeyboardEvent): boolean {
  return (
    event.defaultPrevented ||
    event.isComposing ||
    modified(event) ||
    inOwnWidget(event.target) ||
    layerOpen()
  );
}
