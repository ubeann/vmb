import type { Action } from "svelte/action";

// How far, and how nearly flat, a touch must travel to count as a flick.
const DISTANCE = 56;
const SLOPE = 1.5;

// A leftward flick on a left-hand sheet closes it. Touch only, and only when the
// stroke is mostly horizontal, so scrolling the sheet's own content is left
// alone (the node should be `touch-pan-y`, which keeps the browser from
// claiming horizontal strokes). The sheet's usual close animation plays; it
// does not follow the finger.
export const swipeToClose: Action<HTMLElement, () => void> = (node, close) => {
  let start: { id: number; x: number; y: number } | null = null;

  const down = (event: PointerEvent) => {
    if (event.pointerType === "touch") {
      start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }
  };

  const up = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (-dx >= DISTANCE && -dx > Math.abs(dy) * SLOPE) close();
  };

  const cancel = () => (start = null);

  node.addEventListener("pointerdown", down);
  node.addEventListener("pointerup", up);
  node.addEventListener("pointercancel", cancel);
  return {
    destroy() {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
    }
  };
};
