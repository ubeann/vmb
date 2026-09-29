<!--
  What a signed-out page puts on AuthShell's sheet: the heading, an optional
  description, the page's body and an optional footer. The heading takes focus
  after a client-side move between pages, so a screen reader starts at the new
  page's title. It is not a control, so it draws no focus ring.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    heading,
    description,
    children,
    footer
  }: {
    heading: string;
    description?: Snippet;
    children: Snippet;
    footer?: Snippet;
  } = $props();
</script>

<h1
  id="auth-heading"
  tabindex="-1"
  class="font-display text-3xl font-medium tracking-tight outline-none"
>
  {heading}
</h1>
{#if description}
  <p class="text-muted-foreground mt-2 text-sm text-pretty">{@render description()}</p>
{/if}

<div class="mt-6">{@render children()}</div>

{#if footer}
  <div class="border-border text-muted-foreground mt-6 border-t pt-4 text-sm">
    {@render footer()}
  </div>
{/if}
