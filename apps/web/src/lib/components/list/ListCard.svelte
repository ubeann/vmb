<!--
  The card a list lives in (ADR-0051 rule 2): the toolbar, the table and the
  states between them. It is the `@container/list` that every width rule reads
  (rule 11), so the toolbar's buttons and the table's rows answer to the card's
  own width, which the sidebar changes at the same screen size.

  Two things need that width in script, because they sit outside the card's
  container queries: View's panel (portalled to the body) swaps its columns for
  Sort by and Order once rows fold. So the fold has one definition, the CSS one:
  an empty probe inside the card is shown under 32rem (`@max-lg`, the same line
  that hides the header row and folds the rows), and `folded` follows whether
  it is shown. `useListCard()` hands that to the panel.
-->
<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import { setListCard } from "./list-card.svelte.js";

  let {
    busy = false,
    class: className,
    children
  }: { busy?: boolean; class?: string; children: Snippet } = $props();

  const card = setListCard();

  function watchFold(probe: HTMLElement) {
    const read = () => (card.folded = probe.checkVisibility());
    read();
    const observer = new ResizeObserver(read);
    observer.observe(probe.parentElement!);
    return () => observer.disconnect();
  }
</script>

<div
  aria-busy={busy}
  class={cn(
    "border-border bg-card @container/list relative overflow-hidden rounded-xl border",
    className
  )}
>
  <span aria-hidden="true" data-fold-probe class="hidden @max-lg/list:block" {@attach watchFold}
  ></span>
  {@render children()}
</div>
