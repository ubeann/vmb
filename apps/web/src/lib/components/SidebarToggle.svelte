<!--
  The top bar's menu button on a phone, where the sidebar is a sheet behind it.
  From 48rem the sidebar's own foot button collapses it instead, so this one
  steps aside. It lives in its own component because the sidebar's state is only
  in context below the provider.
-->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { useSidebar } from "$lib/components/ui/sidebar/index.js";
  import TextAlignStart from "@lucide/svelte/icons/text-align-start";

  const sidebar = useSidebar();
</script>

<Button
  variant="ghost"
  size="icon-sm"
  type="button"
  class="md:hidden pointer-coarse:size-11"
  data-sidebar="trigger"
  aria-label="Menu"
  aria-expanded={sidebar.openMobile}
  onclick={sidebar.toggle}
>
  <TextAlignStart class="size-5" aria-hidden="true" />
</Button>
