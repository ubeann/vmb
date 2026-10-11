<!-- Test fixture: a list toolbar's controls, a form's fields, and kit elements beside the legacy layer (control-skin.svelte.test.ts). -->
<script lang="ts">
  import { Layer } from "$lib/components/list/layer/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
</script>

<div class="bg-card flex gap-2 p-4">
  <Input type="search" aria-label="Search" variant="kit" />
  <Button variant="outline">Filter</Button>
  <Button variant="outline" class="rounded-full">Pill</Button>
  <Layer label="View">
    {#snippet trigger({ props })}
      <Button {...props} data-slot="button" variant="outline">View</Button>
    {/snippet}
    <p>Columns</p>
  </Layer>
  <Select.Root type="single" value="25">
    <Select.Trigger aria-label="Rows per page" variant="kit">25</Select.Trigger>
    <Select.Content>
      <Select.Item value="25" label="25" />
    </Select.Content>
  </Select.Root>
</div>

<div class="bg-card flex gap-2 p-4">
  <Input aria-label="Email" />
  <Select.Root type="single" value="a">
    <Select.Trigger aria-label="Division">Division A</Select.Trigger>
    <Select.Content>
      <Select.Item value="a" label="Division A" />
    </Select.Content>
  </Select.Root>
</div>

<dl data-slot="fixture-list">
  <dt data-slot="fixture-term">Term</dt>
  <dd data-slot="fixture-detail">Detail</dd>
</dl>
<label data-slot="fixture-label">Label <input data-slot="fixture-box" type="checkbox" /></label>
