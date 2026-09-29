// The auth pages share one frame (AuthShell) and only the sheet's contents
// change, so a move between them is a View Transition of the sheet: its height
// eases and the old and new contents cross-fade. The API is a progressive
// enhancement. Without it, or under reduced motion, the contents swap at once.
// Its animations are CSS, but the pseudo-elements sit outside the global
// reduced-motion rule, so this gate is where ADR-0035 rule 6 is met.
import { tick } from "svelte";
import { prefersReducedMotion } from "svelte/motion";

type Place = { route: { id: string | null } } | null;

/** True for a client-side move from one auth page to another. */
export function betweenAuthPages({ from, to }: { from: Place; to: Place }): boolean {
  const isAuth = (place: Place) => place?.route.id?.startsWith("/(auth)/") ?? false;
  return isAuth(from) && isAuth(to) && from?.route.id !== to?.route.id;
}

function canTransition(): boolean {
  return "startViewTransition" in document && !prefersReducedMotion.current;
}

function settle(transition: ViewTransition) {
  // A transition skipped by a newer one rejects these; the change still applied.
  transition.ready.catch(() => {});
  transition.finished.catch(() => {});
}

/**
 * For `onNavigate`: resolves once the old sheet is captured, which is when
 * SvelteKit may swap the page in. Returns nothing when the sheet swaps plainly.
 */
export function transitionNavigation(navigation: {
  complete: Promise<void>;
}): Promise<void> | undefined {
  if (!canTransition()) return;
  return new Promise((resolve) => {
    settle(
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
        await tick();
      })
    );
  });
}

/** Runs a change to the sheet's contents inside the same transition. */
export async function transitionUpdate(update: () => Promise<void>): Promise<void> {
  if (!canTransition()) return update();
  const transition = document.startViewTransition(async () => {
    await update();
    await tick();
  });
  settle(transition);
  await transition.updateCallbackDone;
}
