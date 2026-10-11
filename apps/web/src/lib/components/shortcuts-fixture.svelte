<script lang="ts">
  import ShortcutsSheet from "$lib/components/ShortcutsSheet.svelte";
  import Page from "$lib/components/shortcuts-page-fixture.svelte";

  let { withPage = false, layer = false }: { withPage?: boolean; layer?: boolean } = $props();
</script>

<ShortcutsSheet />
<input aria-label="A field" />
{#if layer}<div role="menu" aria-label="A menu"></div>{/if}
{#if withPage}<Page />{/if}
