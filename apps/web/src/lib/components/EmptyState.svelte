<!--
  What a list shows when it has no rows: what is missing, in words, and the one
  thing to do about it. The list decides which case it is (nothing yet, nothing
  matching, an empty Trash) and passes the copy and the action.
-->
<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Component, Snippet } from "svelte";

  let {
    title,
    description,
    icon: Icon,
    headingLevel = 3,
    class: className,
    children
  }: {
    title: string;
    description?: string;
    icon?: Component<{ class?: string; "aria-hidden"?: "true" }>;
    headingLevel?: 2 | 3 | 4;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<div class={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
  {#if Icon}
    <span
      class="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full"
    >
      <Icon class="size-5" aria-hidden="true" />
    </span>
  {/if}
  <div class="max-w-sm space-y-1">
    <svelte:element this={`h${headingLevel}`} class="text-base font-semibold"
      >{title}</svelte:element
    >
    {#if description}
      <p class="text-muted-foreground text-sm">{description}</p>
    {/if}
  </div>
  {#if children}
    <div class="flex flex-wrap justify-center gap-2">{@render children()}</div>
  {/if}
</div>
