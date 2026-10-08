<!--
  The head of a signed-in page (ADR-0035 rule 2, ADR-0050): the title as the
  page's h1, a line saying what the page is, and the one primary action, so the
  action sits at the content's edge instead of the window's.
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

<header class="flex flex-wrap items-end justify-between gap-3">
  <div class="space-y-1">
    <h1 class="font-display text-3xl font-medium tracking-tight">{title}</h1>
    {#if description}
      <p class="text-muted-foreground text-sm">{description}</p>
    {/if}
  </div>
  {#if action}
    {@render action()}
  {/if}
</header>
