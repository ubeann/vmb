<!--
  A text with the searched part marked, so a row says why it is listed
  (ADR-0051 rule 3). Case is the text's own; with no search it is the text.
-->
<script lang="ts">
  import { markMatches } from "./highlight.js";

  let { text, term }: { text: string; term?: string | null } = $props();

  const segments = $derived(markMatches(text, term ?? ""));
</script>

{#each segments as segment, index (index)}{#if segment.match}<mark
      class="bg-primary/15 text-foreground dark:bg-primary/25 rounded-[3px]">{segment.text}</mark
    >{:else}{segment.text}{/if}{/each}
