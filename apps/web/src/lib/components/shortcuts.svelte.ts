// PROTOTYPE (prototype/list-kit): round 50's app-wide keyboard shortcuts. One sheet, opened by
// `?` anywhere or from the sidebar footer, lists what works everywhere and what the current
// page adds. A page registers its sections while it is mounted. Off unless a layout turns it on,
// so the real app is unchanged.
import type { Component } from "svelte";

export type ShortcutRow = { keys: string[]; alt?: string[]; what: string };
export type ShortcutSection = { title: string; icon: Component; rows: ShortcutRow[] };

class Shortcuts {
  enabled = $state(false);
  open = $state(false);
  page = $state<ShortcutSection[]>([]);

  /** A page's sections, for as long as the returned cleanup has not run. */
  register(sections: ShortcutSection[]) {
    this.page = sections;
    return () => {
      if (this.page === sections) this.page = [];
    };
  }
}

export const shortcuts = new Shortcuts();
