<!--
  Light / Dark / System menu. System is the default and the way back from an
  explicit choice. Touch sizes are set here because the trigger and menu items
  carry their own `data-slot`, which the base layer's 44px rule doesn't match.
  The trigger glyph follows the `.dark` class in CSS, so it
  is right on first paint; it scales in when a choice changes the scheme (a keyframe
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

  // The scheme a choice resolves to; System reads the OS.
  const resolve = (choice: string) =>
    choice === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : choice;

  // The glyph that is about to appear, set only when a choice changes the scheme.
  let turnsTo = $state<string>();

  function choose(value: string) {
    if (resolve(value) !== resolve(userPrefersMode.current)) turnsTo = resolve(value);
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
        <span class="glyph" data-turns-to={turnsTo}>
          <Sun class="sun dark:hidden" aria-hidden="true" />
          <Moon class="moon hidden dark:block" aria-hidden="true" />
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

  /* On the incoming glyph only: it starts when the class swap shows it, so the
     outgoing one never blinks and a choice that changes nothing stays still. */
  .glyph[data-turns-to="dark"] :global(.moon),
  .glyph[data-turns-to="light"] :global(.sun) {
    animation: glyph-in var(--duration-icon) var(--easing-standard);
  }

  @keyframes glyph-in {
    from {
      opacity: 0;
      scale: 0.25;
      filter: blur(4px);
    }
  }
</style>
