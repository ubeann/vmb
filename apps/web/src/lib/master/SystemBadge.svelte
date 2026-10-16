<!--
  Marks a System Role (#303): a seeded Role that VMB depends on, which nobody
  can edit or delete. A lock and the word, so it reads without colour or a
  tooltip (ADR-0035 rule 5); it sits next to the Role's name wherever the name
  does.
-->
<script lang="ts">
  import { cn } from "$lib/utils.js";
  import LockIcon from "@lucide/svelte/icons/lock";

  let { class: className }: { class?: string } = $props();
</script>

<span
  data-slot="system-badge"
  title="A System Role can't be edited or deleted"
  class={cn(
    "border-border bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
    className
  )}
>
  <LockIcon aria-hidden="true" class="size-3" />System
</span>
