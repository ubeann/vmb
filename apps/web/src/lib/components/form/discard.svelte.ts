// "Discard changes?" (#302): a form with unsaved edits asks before it is
// closed or left. It is a shared form piece, so every record form gets it the
// same way; the layer a form sits in asks it before closing.

import { beforeNavigate, goto } from "$app/navigation";
import { getContext, onMount, setContext } from "svelte";

/** Resolves true when the form may go: nothing to lose, or the user chose to discard. */
type Check = () => Promise<boolean>;

const KEY = Symbol("close-checks");

/**
 * What a layer asks before it closes: each form inside it may be holding
 * unsaved edits. A layer that holds forms makes one with `provideCloseChecks`.
 */
class CloseChecks {
  #checks = new Set<Check>();

  add(check: Check) {
    this.#checks.add(check);
    return () => void this.#checks.delete(check);
  }

  /** Whether every form inside agrees to go, asking each in turn. */
  async allow() {
    for (const check of this.#checks) if (!(await check())) return false;
    return true;
  }
}

/** Makes the checks the forms rendered inside this component register with. */
export function provideCloseChecks() {
  return setContext(KEY, new CloseChecks());
}

/** One form's question, and its answer. */
export class DiscardGuard {
  /** The "Discard changes?" dialog is open. */
  asking = $state(false);
  #answer: ((discard: boolean) => void) | null = null;
  #released = false;
  readonly #dirty: () => boolean;

  constructor(dirty: () => boolean) {
    this.#dirty = dirty;
  }

  /** Whether leaving now would lose edits. */
  get needed() {
    return !this.#released && this.#dirty();
  }

  /** Asks, if there is anything to lose. */
  confirm(): Promise<boolean> {
    if (!this.needed) return Promise.resolve(true);
    // a second ask while one is open answers the first as "keep editing"
    this.#answer?.(false);
    this.asking = true;
    return new Promise((resolve) => (this.#answer = resolve));
  }

  /** The user's answer: discard the edits, or keep editing. */
  answer(discard: boolean) {
    const answer = this.#answer;
    this.#answer = null;
    this.asking = false;
    if (discard) this.#released = true;
    answer?.(discard);
  }

  /** The edits were saved: nothing is lost by leaving now. */
  release() {
    this.#released = true;
  }
}

/**
 * A guard for the form this component renders. It asks before the layer the
 * form sits in closes, and before a navigation leaves it: a link, a `goto`, a
 * Back to another page. Closing the tab or reloading gets the browser's own
 * question, since a page may not show its own there.
 *
 * A layer's frame changing with the screen (ADR-0053 rule 6) is not a closing
 * and no navigation, so it asks nothing.
 */
export function useDiscardGuard(dirty: () => boolean): DiscardGuard {
  const guard = new DiscardGuard(dirty);
  const layer = getContext<CloseChecks | undefined>(KEY);

  onMount(() => layer?.add(() => guard.confirm()));

  beforeNavigate((navigation) => {
    if (!guard.needed) return;
    // cancelling a leave makes the browser ask its own question
    navigation.cancel();
    if (navigation.type === "leave" || !navigation.to) return;
    const to = navigation.to.url;
    const delta = navigation.type === "popstate" ? navigation.delta : null;
    void guard.confirm().then((discard) => {
      if (!discard) return;
      if (delta) history.go(delta);
      // eslint-disable-next-line svelte/no-navigation-without-resolve -- the URL SvelteKit was already navigating to
      else void goto(to);
    });
  });

  return guard;
}
