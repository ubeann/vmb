<!--
  The top bar's button for the sidebar. On desktop it folds the sidebar to icons
  and back, so it wears the panel glyph; on a phone it opens the menu sheet, so
  it wears the menu glyph. It lives in its own component because the sidebar's
  state is only in context below the provider.
-->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { useSidebar } from "$lib/components/ui/sidebar/index.js";
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import TextAlignStart from "@lucide/svelte/icons/text-align-start";

  const sidebar = useSidebar();
</script>

<Button
  variant="ghost"
  size="icon-sm"
  type="button"
  class="pointer-coarse:size-11"
  data-sidebar="trigger"
  aria-expanded={sidebar.isMobile ? sidebar.openMobile : sidebar.open}
  onclick={sidebar.toggle}
>
  <TextAlignStart class="size-5 md:hidden" aria-hidden="true" />
  <PanelLeft class="cn-rtl-flip hidden md:block" aria-hidden="true" />
  <span class="sr-only">Toggle Sidebar</span>
</Button>
