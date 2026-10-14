// A record layer over its list, on SvelteKit's shallow routing (#302). The
// record's own URL (`/master/divisions/<id>`, `/edit`, `/new`) goes in the
// address bar and its page's data in `page.state`, so the list underneath
// keeps its search, filters, sort and page, and closing goes back to the URL
// it left. Opened directly, or without JavaScript, the same URLs are full pages.

import { goto, preloadData, pushState, replaceState } from "$app/navigation";
import { page } from "$app/state";
import { provideCloseChecks } from "$lib/components/form/discard.svelte.js";
import { untrack } from "svelte";

/** What the layer shows, as `page.state.layer` carries it. */
export type LayerEntry<K extends string = string> = {
  /** Which of the record's pages: such as "view", "edit" or "new". */
  kind: K;
  href: string;
  /** How many history entries this layer has pushed over the list. */
  depth: number;
  /** The page's load data, as its full page gets it. */
  data: Record<string, unknown>;
};

const same = (a: LayerEntry | null, b: LayerEntry | null) =>
  a?.href === b?.href && a?.depth === b?.depth;

export class LayerRoute<K extends string = string> {
  /**
   * The entry shown. It follows `page.state`, except that a Back out of a
   * form with unsaved edits holds it until "Discard changes?" is answered.
   */
  shown = $state.raw<LayerEntry<K> | null>(null);
  /** What the forms in the layer register with, to ask before it closes. */
  readonly checks = provideCloseChecks();
  #closing = false;
  #opener: HTMLElement | null = null;
  // the latest open and the latest history step, so an older one that resolves late is dropped
  #opening = 0;
  #following = 0;

  constructor() {
    $effect(() => {
      const next = (page.state.layer as LayerEntry<K> | undefined) ?? null;
      untrack(() => void this.#follow(next));
    });
  }

  /**
   * Opens a record page in the layer, one step deeper than what it shows.
   * `opener` gets focus back once the layer closes; a step inside the layer
   * keeps the first one.
   */
  async open(href: string, kind: K, opener?: HTMLElement | null) {
    if (!this.shown) this.#opener = opener ?? null;
    const opening = ++this.#opening;
    const from = this.shown;
    const result = await preloadData(href);
    // a later open, or a Back or close meanwhile, wins
    if (opening !== this.#opening || this.shown !== from) return;
    // a page that refuses (403, 404) or fails answers as it does opened directly
    if (result.type !== "loaded" || result.status !== 200) {
      // eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a resolve()d path
      await goto(href);
      return;
    }
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a resolve()d path
    pushState(href, { layer: { kind, href, depth: (from?.depth ?? 0) + 1, data: result.data } });
  }

  /** Loads what the layer shows again, as after a Restore from it. */
  async refresh() {
    const shown = this.shown;
    if (!shown) return;
    const result = await preloadData(shown.href);
    if (result.type !== "loaded" || result.status !== 200 || this.shown !== shown) return;
    const entry = { ...shown, data: result.data };
    this.shown = entry;
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- the href it was opened at
    replaceState(shown.href, { layer: entry });
  }

  /** The user asked to close: the forms inside may ask first. */
  async close() {
    if (!this.shown || !(await this.checks.allow())) return;
    this.closeNow();
  }

  /** Closes with nothing to ask, as after a save. */
  closeNow() {
    if (!this.shown) return;
    this.#closing = true;
    history.go(-this.shown.depth);
  }

  /** Where focus goes once the layer has closed. */
  returnFocus = () => this.#opener;

  async #follow(next: LayerEntry<K> | null) {
    const following = ++this.#following;
    const shown = this.shown;
    if (same(next, shown)) return;
    if (this.#closing || !shown || (next && next.depth > shown.depth)) {
      if (!next) this.#closing = false;
      this.shown = next;
      return;
    }
    // Back (the browser's, or a phone's gesture) out of what the layer shows,
    // which may be a form with unsaved edits: asked, it either goes or comes back
    const allowed = await this.checks.allow();
    // another step through history while asking: that one decides
    if (following !== this.#following) return;
    if (allowed) this.shown = next;
    else history.go(shown.depth - (next?.depth ?? 0));
  }
}
