import { untrack, type Component } from "svelte";

/** One line of the sheet: the action in words, and its keys (`alt` is the other way to do it). */
export type ShortcutRow = { keys: string[]; alt?: string[]; what: string };
export type ShortcutSection = { title: string; icon: Component; rows: ShortcutRow[] };

/**
 * The app's one shortcut sheet (ADR-0052). `?` or the sidebar's row opens it; a page adds its
 * own sections while it is mounted, with `useShortcuts`, so a page with none shows
 * "Everywhere" alone.
 */
class Shortcuts {
  open = $state(false);
  #registered = $state.raw<ShortcutSection[][]>([]);

  /** The sections of every page that is mounted, in the order they registered. */
  get page(): ShortcutSection[] {
    return this.#registered.flat();
  }

  /** Adds a page's sections; call the returned function to take them away. */
  register(sections: ShortcutSection[]): () => void {
    this.#registered = [...this.#registered, sections];
    return () => {
      this.#registered = this.#registered.filter((registered) => registered !== sections);
    };
  }
}

export const shortcuts = new Shortcuts();

/** Lists a page's sections on the sheet for as long as the page is mounted. Call it while the component initialises. */
export function useShortcuts(sections: () => ShortcutSection[]) {
  $effect(() => {
    const own = sections();
    // registering reads the list it adds to, which this effect must not depend on
    return untrack(() => shortcuts.register(own));
  });
}
