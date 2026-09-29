<!--
  Light/dark switch. One button rather than a light/dark/system menu: the
  scheme follows the system until the first press, then the choice persists.
  The touch target comes from the base layer's 44px rule. The glyph follows the `.dark` class in CSS, so it is right on first paint;
  the label needs `mode`, which is only known once the page hydrates.
-->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";
  import { mode, toggleMode } from "mode-watcher";

  let { class: className }: { class?: string } = $props();
</script>

<Button
  variant="ghost"
  size="icon"
  class={className}
  aria-label={mode.current === "dark" ? "Switch to light mode" : "Switch to dark mode"}
  onclick={toggleMode}
>
  <Moon class="dark:hidden" aria-hidden="true" />
  <Sun class="hidden dark:block" aria-hidden="true" />
</Button>
