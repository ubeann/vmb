// The list's own URL (#302). A record layer over the list puts the record's
// URL in the address bar (shallow routing), so `page.url` stops being the
// list's; its search, filters, sort and page must stay as they were, behind
// the layer and once it closes.

import { page, type ReadonlyURL } from "$app/state";
import { getContext, setContext } from "svelte";

const KEY = Symbol("list-url");

/**
 * Makes the list page's URL the one the kit's controls read: `page.url` while
 * it is the list's own (`base`), and the last one it was while a record layer
 * shows another.
 */
export function provideListUrl(base: string) {
  let last = page.url;
  const url = $derived.by(() => {
    if (page.url.pathname === base) last = page.url;
    return last;
  });
  setContext(KEY, () => url);
}

/**
 * What a list control reads its state from, in place of `$app/state`'s `page`:
 * the list's URL where a list page provides one, and `page.url` elsewhere.
 */
export function listPage(): { readonly url: ReadonlyURL } {
  const url = getContext<(() => URL) | undefined>(KEY);
  return {
    get url() {
      return url ? url() : page.url;
    }
  };
}
