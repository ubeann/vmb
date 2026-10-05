<!-- Test fixture: the registry select, as a form field uses it (select-ring.svelte.test.ts). -->
<script lang="ts">
  import * as Select from "$lib/components/ui/select/index.js";
</script>

<Select.Root type="single" value="a">
  <Select.Trigger aria-label="Division">Division A</Select.Trigger>
  <Select.Content>
    <Select.Item value="a" label="Division A" />
  </Select.Content>
</Select.Root>
