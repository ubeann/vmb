<!--
  Show or hide a list's columns (#301); the choice is saved per list in the
  browser by `ColumnVisibility`. Pinned columns (the record's name) are not
  offered.
-->
<script lang="ts" generics="Id extends string">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import Columns3Icon from "@lucide/svelte/icons/columns-3";
  import type { ColumnVisibility } from "./column-visibility.svelte.js";

  let { columns }: { columns: ColumnVisibility<Id> } = $props();

  const hideable = $derived(columns.columns.filter((column) => columns.hideable(column.id)));
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline">
        <Columns3Icon aria-hidden="true" data-icon="inline-start" />Columns
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" class="w-48">
    <DropdownMenu.Group>
      <DropdownMenu.GroupHeading>Show columns</DropdownMenu.GroupHeading>
      {#each hideable as column (column.id)}
        <DropdownMenu.CheckboxItem
          checked={columns.visible(column.id)}
          onCheckedChange={(checked) => columns.set(column.id, checked)}
          closeOnSelect={false}
        >
          {column.label}
        </DropdownMenu.CheckboxItem>
      {/each}
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>
