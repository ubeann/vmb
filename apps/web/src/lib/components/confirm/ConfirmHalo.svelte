<!--
  A confirmation's icon, centred in a soft halo of its tone (#302): red for an
  act that removes something (Delete), amber for one that loses work
  (Discard). Decorative: the title says what the dialog asks.
-->
<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Component } from "svelte";

  let {
    icon: Icon,
    tone = "danger"
  }: {
    icon: Component<{ class?: string }>;
    tone?: "danger" | "warning";
  } = $props();
</script>

<span
  aria-hidden="true"
  data-slot="confirm-halo"
  class={cn(
    "flex size-14 shrink-0 items-center justify-center rounded-full ring-8",
    tone === "danger"
      ? "bg-destructive/12 text-destructive ring-destructive/6"
      : // light mode's --warning is a dark amber for text, and a wash of it reads beige: the halo takes a bright amber
        "dark:bg-warning/15 dark:text-warning dark:ring-warning/8 bg-amber-100 text-amber-600 ring-amber-50"
  )}
>
  <Icon class="size-6" />
</span>
