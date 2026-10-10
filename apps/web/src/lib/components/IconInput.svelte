<!--
  A text field with a decorative leading icon, and room for a control at its
  trailing edge. The wrapper is the field's own: password-manager extensions
  insert elements after the input, and inside this box they can't pick up the
  form's spacing. The icon never takes the pointer; the label names the field.
-->
<script lang="ts">
  import { Input } from "$lib/components/ui/input/index.js";
  import { cn } from "$lib/utils.js";
  import type { Component, Snippet } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";

  let {
    icon: Icon,
    trailing,
    class: className,
    ...restProps
  }: Omit<HTMLInputAttributes, "type" | "files"> & {
    type?: "text" | "email" | "password";
    icon: Component<{ class?: string; "aria-hidden"?: "true" }>;
    // Positioned by the caller against the wrapper's right edge; pass `pr-*` to make room for it.
    trailing?: Snippet;
  } = $props();
</script>

<div class="relative">
  <Icon
    class="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 my-auto size-4"
    aria-hidden="true"
  />
  <Input class={cn("rounded-touch min-h-11 pl-9", className)} {...restProps} />
  {@render trailing?.()}
</div>
