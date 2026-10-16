<!--
  A layer's main action (ADR-0053 rule 4). It names the result ("Show 12
  divisions", "Apply 2 – 5 Jan") and fills the footer; it carries the icon of
  what it confirms only once it can be pressed. A label the footer has no room
  for is cut short, the full text its title.
-->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { cn } from "$lib/utils.js";
  import type { Component } from "svelte";

  let {
    label,
    full = label,
    icon: Icon,
    disabled = false,
    onclick,
    class: className
  }: {
    label: string;
    /** The label at full length, where `label` is a shortened one. */
    full?: string;
    icon?: Component<{ "aria-hidden"?: "true"; "data-icon"?: string }>;
    disabled?: boolean;
    onclick?: () => void;
    class?: string;
  } = $props();
</script>

<Button
  data-layer-action
  class={cn("min-w-0 flex-1 tabular-nums", className)}
  title={full}
  {disabled}
  {onclick}
>
  {#if Icon && !disabled}<Icon aria-hidden="true" data-icon="inline-start" />{/if}
  <span class="truncate">{label}</span>
</Button>
