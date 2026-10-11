<!--
  A key as a cap (ADR-0052 rule 2): on the sheet at full size, in a row menu at `sm`.
  Backspace is drawn as its glyph; the ⌫ character renders too small in most fonts.
-->
<script lang="ts">
  import { cn } from "$lib/utils.js";
  import DeleteIcon from "@lucide/svelte/icons/delete";

  let { key, size = "md" }: { key: string; size?: "md" | "sm" } = $props();

  const backspace = $derived(key === "⌫" || key === "Backspace");
</script>

<kbd
  class={cn(
    "inline-flex items-center justify-center font-mono",
    size === "md"
      ? "bg-muted text-muted-foreground border-border h-7 min-w-7 rounded-md border px-2 text-xs"
      : "border-border h-5 min-w-5 rounded border px-1 text-[0.7rem]"
  )}
>
  {#if backspace}
    <DeleteIcon role="img" aria-label="Backspace" class={size === "md" ? "size-3.5" : "size-3"} />
  {:else}
    {key}
  {/if}
</kbd>
