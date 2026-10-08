<!--
  The body of a signed-in page (ADR-0050): its content is capped and centred
  inside the white panel, which stays full width. `narrow` (48rem) is for forms
  and detail pages, `default` (90rem) for lists, `full` for a table that earns
  the whole width.
-->
<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";

  let {
    width = "default",
    class: className,
    children
  }: {
    width?: "narrow" | "default" | "full";
    class?: string;
    children: Snippet;
  } = $props();

  const WIDTHS = {
    narrow: "max-w-3xl",
    default: "max-w-[90rem]",
    full: ""
  };
</script>

<div class={cn("mx-auto w-full min-w-0", WIDTHS[width], className)}>
  {@render children()}
</div>
