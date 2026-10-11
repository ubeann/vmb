// The rules behind the kit's layer (ADR-0053), kept apart from the component
// so they can be checked without a browser.

/**
 * The frame a layer takes at a window width (rule 1). Under 640px it is modal:
 * a bottom sheet, which CSS turns into a centred dialog from 480px, since the
 * content and steps don't change across that line. From 640px it is the panel
 * by its button.
 */
export type LayerFrame = "panel" | "modal";

const PANEL_FROM = 640;

/**
 * The frame the window is in now. It reads the media query rather than
 * `innerWidth`: under a DevTools device preset a panel still on screen past
 * the phone's edge widens the window, but not the media query's width.
 */
export const frameNow = (): LayerFrame =>
  matchMedia(`(min-width: ${PANEL_FROM}px)`).matches ? "panel" : "modal";

/** The panel's width where its picker fits beside it (20rem), and where it doesn't (22rem). */
const PANEL_WIDTH = 320;

/** How far the picker opens from the panel, and how far it keeps off the window's edge. */
export const BESIDE_OFFSET = 12;
const EDGE = 8;

/**
 * Whether a picker fits to the left of a 20rem panel opened by a button whose
 * right edge is at `buttonRight` (rule 2). The room is measured from the
 * button, not a breakpoint, because the sidebar changes it at the same width.
 */
export const fitsBeside = (buttonRight: number, pickerWidth: number) =>
  buttonRight - PANEL_WIDTH >= pickerWidth + BESIDE_OFFSET + EDGE;

/** A handover waits until the window has stopped resizing this long (rule 6). */
export const SETTLE_MS = 200;

/** A scrollbar's width: the most the window and the page may disagree by. */
const SCROLLBAR = 20;
const STEADY_CAP_MS = 1000;

type SteadyOptions = {
  gap?: () => number;
  frame?: (fn: () => void) => unknown;
  now?: () => number;
};

/**
 * Calls `open` once the window and the page agree on the width, a scrollbar
 * apart, or after a second (rule 6). A modal layer locks scrolling and pads the
 * page by "window − page", read as the scrollbar; a panel still on screen past
 * a phone's new edge widens the window (691px for a 425px page after a DevTools
 * device preset), and opening then would squeeze the page by the difference.
 * Returns a function that calls it off.
 */
export function whenSteady(
  open: () => void,
  {
    gap = () => innerWidth - document.documentElement.clientWidth,
    frame = requestAnimationFrame,
    now = () => performance.now()
  }: SteadyOptions = {}
) {
  const start = now();
  let cancelled = false;
  const check = () => {
    if (cancelled) return;
    const apart = gap();
    if ((apart >= 0 && apart <= SCROLLBAR) || now() - start >= STEADY_CAP_MS) open();
    else frame(check);
  };
  frame(check);
  return () => {
    cancelled = true;
  };
}
