<!--
  The head of a signed-in page (ADR-0035 rule 2, ADR-0050 rule 2): the title as
  the page's h1 and the one primary action on a row, and under them one line
  saying what the page is, about 60ch at most, so the action sits at the
  content's edge instead of the window's.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    description,
    action
  }: {
    title: string;
    description?: string;
    action?: Snippet;
  } = $props();
</script>

<header class="flex flex-col gap-1">
  <div class="flex items-center justify-between gap-4">
    <h1 class="font-display text-2xl leading-8 font-medium tracking-tight">{title}</h1>
    {#if action}
      <div class="shrink-0">{@render action()}</div>
    {/if}
  </div>
  {#if description}
    <p class="text-muted-foreground max-w-[60ch] text-sm text-pretty">{description}</p>
  {/if}
</header>
