<!--
  Select all for a card narrower than 32rem (#305), where the header row, and the
  checkbox in it, is gone (ADR-0051 rule 11): a strip above the rows with the same
  box. It selects the page's rows and no others, like the header's.
-->
<script lang="ts">
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";

  let {
    ref = $bindable(null),
    state,
    count,
    onchange
  }: {
    ref?: HTMLElement | null;
    /** How much of the page is chosen. */
    state: "none" | "some" | "all";
    /** The rows on the page. */
    count: number;
    /** Select the whole page, or clear it. */
    onchange: () => void;
  } = $props();
</script>

<div
  class="border-border text-muted-foreground flex items-center gap-2.5 border-b px-3 py-2 text-sm @lg/list:hidden"
>
  <Checkbox
    variant="kit"
    bind:ref
    checked={state === "all"}
    indeterminate={state === "some"}
    onCheckedChange={onchange}
    aria-label="Select all {count} on this page"
  />
  <span aria-hidden="true">Select all on this page</span>
</div>
