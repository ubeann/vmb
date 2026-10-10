<!-- Test fixture: a list toolbar's controls, and kit elements beside the legacy layer (control-skin.svelte.test.ts). -->
<script lang="ts">
  import ColumnsMenu from "$lib/components/list/ColumnsMenu.svelte";
  import { ColumnVisibility } from "$lib/components/list/column-visibility.svelte.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as Select from "$lib/components/ui/select/index.js";

  const columns = new ColumnVisibility("fixture", [
    { id: "name", label: "Name", hideable: false },
    { id: "code", label: "Code" }
  ]);
</script>

<div class="bg-card flex gap-2 p-4">
  <Input type="search" aria-label="Search" />
  <Button variant="outline">Filter</Button>
  <Button variant="outline" class="rounded-full">Pill</Button>
  <ColumnsMenu {columns} />
  <Select.Root type="single" value="25">
    <Select.Trigger aria-label="Rows per page">25</Select.Trigger>
    <Select.Content>
      <Select.Item value="25" label="25" />
    </Select.Content>
  </Select.Root>
</div>

<dl data-slot="fixture-list">
  <dt data-slot="fixture-term">Term</dt>
  <dd data-slot="fixture-detail">Detail</dd>
</dl>
<label data-slot="fixture-label">Label <input data-slot="fixture-box" type="checkbox" /></label>
