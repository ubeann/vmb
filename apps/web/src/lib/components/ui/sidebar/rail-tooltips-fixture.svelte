<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
</script>

<!-- two rail icons under the sidebar's own provider, as the collapsed rail has them -->
<Sidebar.Provider open={false}>
  {#each ["One", "Two"] as name (name)}
    <Tooltip.Root>
      <Tooltip.Trigger class="m-4 size-8">{name}</Tooltip.Trigger>
      <Tooltip.Content>{name} tip</Tooltip.Content>
    </Tooltip.Root>
  {/each}
</Sidebar.Provider>
