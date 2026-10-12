import { untrack, type Component } from "svelte";

/**
 * One line of the sheet: the action in words, and its keys (`alt` is the other way to do it).
 * `single` marks keys that are one printable character, and `altSingle` marks only the `alt`
 * ones; the switch for single-key shortcuts turns those off (ADR-0052 rule 5).
 */
export type ShortcutRow = {
  keys: string[];
  alt?: string[];
  what: string;
  single?: boolean;
  altSingle?: boolean;
};
export type ShortcutSection = { title: string; icon: Component; rows: ShortcutRow[] };

/** Where the single-key switch is remembered. */
export const SINGLE_KEY_STORAGE = "vmb:single-key-shortcuts";

/**
 * The app's one shortcut sheet (ADR-0052). `?` or the sidebar's row opens it; a page adds its
 * own sections while it is mounted, with `useShortcuts`, so a page with none shows
 * "Everywhere" alone.
 */
class Shortcuts {
  open = $state(false);
  /**
   * Whether the single-character shortcuts (`?`, `/`, J/K, a row's action keys) work. On
   * unless the user switched them off (WCAG 2.1.4); remembered in the browser.
   */
  singleKey = $state(true);
  #registered = $state.raw<ShortcutSection[][]>([]);

  /**
   * The sections of every page that is mounted, in the order they registered. Two parts of a
   * page may add to one section (the search and the keyboard rows both list `/`): sections
   * with the same title become one, and a row already listed is not listed twice.
   */
  get page(): ShortcutSection[] {
    const merged: ShortcutSection[] = [];
    for (const section of this.#registered.flat()) {
      const into = merged.find((listed) => listed.title === section.title);
      if (!into) {
        merged.push({ ...section, rows: [...section.rows] });
        continue;
      }
      for (const row of section.rows) {
        if (!into.rows.some((listed) => listed.what === row.what)) into.rows.push(row);
      }
    }
    return merged;
  }

  /** Reads the remembered switch. Run once the app is in the browser, so the server's page and the first client render agree. */
  restore() {
    try {
      this.singleKey = localStorage.getItem(SINGLE_KEY_STORAGE) !== "off";
    } catch {
      // storage is blocked: the switch still works, it just isn't remembered
    }
  }

  /** Turns the single-character shortcuts on or off, and remembers it. */
  setSingleKey(on: boolean) {
    this.singleKey = on;
    try {
      localStorage.setItem(SINGLE_KEY_STORAGE, on ? "on" : "off");
    } catch {
      // see `restore`
    }
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
