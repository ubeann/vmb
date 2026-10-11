<!-- A layer's scrolling content, between its header and its footer. -->
<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    class: className,
    children,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & { children: Snippet } = $props();
</script>

<div class={cn("min-h-0 flex-1 overflow-y-auto", className)} {...rest}>
  {@render children()}
</div>
