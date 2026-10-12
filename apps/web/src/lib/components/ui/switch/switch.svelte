<script lang="ts">
  import { Switch as SwitchPrimitive } from "bits-ui";
  import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    checked = $bindable(false),
    class: className,
    ...restProps
  }: WithoutChildrenOrChild<SwitchPrimitive.RootProps> = $props();
</script>

<!-- The off track keeps the 3:1 `--input` edge: an off switch has nothing else to show it (WCAG 1.4.11). -->
<SwitchPrimitive.Root
  bind:ref
  bind:checked
  data-slot="switch"
  class={cn(
    "border-input bg-background data-checked:bg-primary data-checked:border-primary focus-visible:ring-ring/50 peer relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors outline-none after:absolute after:-inset-x-1 after:-inset-y-2.5 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:after:-inset-y-3",
    className
  )}
  {...restProps}
>
  <SwitchPrimitive.Thumb
    data-slot="switch-thumb"
    class="bg-foreground data-checked:bg-primary-foreground pointer-events-none block size-4 translate-x-1 rounded-full transition-transform data-checked:translate-x-6 motion-reduce:transition-none"
  />
</SwitchPrimitive.Root>
