<!--
  Light / Dark / System menu. System is the default and the way back from an
  explicit choice. Touch sizes are set here because the trigger and menu items
  carry their own `data-slot`, which the base layer's 44px rule doesn't match.
  The trigger glyph follows the `.dark` class in CSS, so it
  is right on first paint; it turns in once a choice is made (a keyframe
  animation, because mode-watcher suppresses CSS transitions while the class
  changes). The global reduced-motion rule collapses it.
-->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { cn } from "$lib/utils.js";
  import Monitor from "@lucide/svelte/icons/monitor";
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";
  import { resetMode, setMode, userPrefersMode } from "mode-watcher";

  let { class: className }: { class?: string } = $props();

  const item = "pointer-coarse:min-h-11";

  let chosen = $state(false);

  function choose(value: string) {
    chosen = true;
    if (value === "light" || value === "dark") setMode(value);
    else resetMode();
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="ghost"
        size="icon"
        class={cn("pointer-coarse:size-11", className)}
        aria-label="Theme"
      >
        <span class="glyph" class:chosen>
          <Sun class="dark:hidden" aria-hidden="true" />
          <Moon class="hidden dark:block" aria-hidden="true" />
        </span>
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" class="min-w-36">
    <DropdownMenu.RadioGroup value={userPrefersMode.current} onValueChange={choose}>
      <DropdownMenu.RadioItem value="light" class={item}
        ><Sun aria-hidden="true" />Light</DropdownMenu.RadioItem
      >
      <DropdownMenu.RadioItem value="dark" class={item}
        ><Moon aria-hidden="true" />Dark</DropdownMenu.RadioItem
      >
      <DropdownMenu.RadioItem value="system" class={item}>
        <Monitor aria-hidden="true" />System
      </DropdownMenu.RadioItem>
    </DropdownMenu.RadioGroup>
  </DropdownMenu.Content>
</DropdownMenu.Root>

<style>
  .glyph {
    display: grid;
    place-items: center;
  }

  .chosen :global(svg) {
    animation: glyph-in 0.3s ease-out;
  }

  @keyframes glyph-in {
    from {
      opacity: 0;
      rotate: -90deg;
      scale: 0.4;
    }
  }
</style>
