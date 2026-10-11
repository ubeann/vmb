<script lang="ts">
  import ShortcutsSheet from "$lib/components/ShortcutsSheet.svelte";
  import ListSearch from "./ListSearch.svelte";
  import { RowKeys } from "./row-keys.svelte.js";

  let { keyboardRows = false }: { keyboardRows?: boolean } = $props();

  // svelte-ignore state_referenced_locally
  new RowKeys({
    enabled: keyboardRows,
    title: "Divisions",
    items: () => [],
    open: () => {},
    actions: () => [],
    help: [{ keys: ["E"], what: "Edit", single: true }]
  });
</script>

<ListSearch base="/master/divisions" label="Search divisions" listName="Divisions" />
<ShortcutsSheet />
