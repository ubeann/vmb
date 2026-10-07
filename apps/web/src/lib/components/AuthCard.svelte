<!--
  What a signed-out page puts on AuthShell's sheet: the heading, an optional
  description, the page's body and an optional footer. The heading takes focus
  after a client-side move between pages, so a screen reader starts at the new
  page's title. It is not a control, so it draws no focus ring.

  A page made of steps gives `step`: its place is set under the heading in the
  masthead's tracked capitals, like a folio on a printed form, and read right
  after the heading. Under, not beside: a long heading or a translated one
  would push it to the next line on some steps and not others.

  Below `sm` the heading steps down a size, so it doesn't twin the brand line
  above the sheet.

  `describedby` names a notice the page shows on arrival. A status region that
  arrives already filled is often not read out, but the heading is focused
  after a move between pages, so it carries the notice as its description.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    heading,
    description,
    children,
    footer,
    step,
    describedby
  }: {
    heading: string;
    step?: { at: number; of: number };
    /** The id of a notice to read with the heading. */
    describedby?: string;
    description?: Snippet;
    children: Snippet;
    footer?: Snippet;
  } = $props();
</script>

<h1
  id="auth-heading"
  tabindex="-1"
  aria-describedby={describedby}
  class="font-display text-2xl font-medium tracking-tight text-balance outline-none sm:text-3xl"
>
  {heading}
</h1>
{#if step}
  <p class="text-muted-foreground mt-1.5 text-xs font-medium tracking-[0.2em] uppercase">
    Step {step.at} of {step.of}
  </p>
{/if}
{#if description}
  <p class="text-muted-foreground mt-2 text-sm text-pretty">{@render description()}</p>
{/if}

<div class="mt-6">{@render children()}</div>

{#if footer}
  <div class="border-border text-muted-foreground mt-6 border-t pt-4 text-sm">
    {@render footer()}
  </div>
{/if}
