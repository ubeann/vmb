import { SvelteSet } from "svelte/reactivity";

/**
 * The rows chosen for a bulk action on a list (#305). "Select all" is the
 * page's own rows and no others, so what the bar's count says is what the
 * action takes. The list page clears it when its URL or its rows change.
 */
export class Selection {
  #ids = new SvelteSet<string>();

  get count() {
    return this.#ids.size;
  }

  /** The chosen ids, in the order they were chosen. */
  get ids(): string[] {
    return [...this.#ids];
  }

  has(id: string): boolean {
    return this.#ids.has(id);
  }

  /** Flip a row, or set it when `on` is given (a checkbox says which it wants). */
  toggle(id: string, on = !this.#ids.has(id)) {
    if (on) this.#ids.add(id);
    else this.#ids.delete(id);
  }

  /** Whether none, some or all of `page` is chosen, for the header checkbox. */
  stateOf(page: readonly string[]): "none" | "some" | "all" {
    const chosen = page.filter((id) => this.#ids.has(id)).length;
    if (chosen === 0) return "none";
    return chosen === page.length ? "all" : "some";
  }

  setPage(page: readonly string[], on: boolean) {
    for (const id of page) this.toggle(id, on);
  }

  /** Drop what is no longer on the page. */
  keep(page: readonly string[]) {
    for (const id of [...this.#ids]) if (!page.includes(id)) this.#ids.delete(id);
  }

  clear() {
    this.#ids.clear();
  }
}
