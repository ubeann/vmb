<!--
  A titled group of a record form's fields (#302), so a form reads as a few
  sections rather than one long column. A section that follows another starts
  at a dashed line. Without a title it is only that break: a row such as
  Active that labels itself.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, hint, children }: { title?: string; hint?: string; children: Snippet } = $props();

  const id = $props.id();
</script>

<div
  data-slot="form-section"
  role={title ? "group" : undefined}
  aria-labelledby={title ? id : undefined}
  class="border-border flex flex-col gap-4 [[data-slot=form-section]+&]:border-t [[data-slot=form-section]+&]:border-dashed [[data-slot=form-section]+&]:pt-5"
>
  {#if title}
    <div class="flex flex-col gap-0.5">
      <h3 {id} class="text-sm leading-tight font-semibold">{title}</h3>
      {#if hint}<p class="text-muted-foreground text-xs">{hint}</p>{/if}
    </div>
  {/if}
  {@render children()}
</div>
