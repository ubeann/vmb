<script lang="ts">
  import KeyCap from "$lib/components/KeyCap.svelte";
  import ShortcutsSheet from "$lib/components/ShortcutsSheet.svelte";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import Layer from "./layer/Layer.svelte";
  import { RowKeys } from "./row-keys.svelte.js";
  import { ROW_CLASS } from "./rows.js";

  let {
    enabled,
    log,
    names = ["Alpha", "Bravo", "Charlie"],
    layer = false
  }: {
    enabled: boolean;
    log: (what: string) => void;
    names?: string[];
    layer?: boolean;
  } = $props();

  const items = $derived(names.map((name) => ({ id: name.toLowerCase(), name })));

  // svelte-ignore state_referenced_locally
  const keys = new RowKeys({
    enabled,
    title: "Test",
    items: () => items,
    open: (item) => log(`open ${item.name}`),
    actions: (item) => [
      { key: "E", run: () => log(`edit ${item.name}`) },
      { key: "Backspace", run: () => log(`delete ${item.name}`) }
    ],
    help: [
      { keys: ["E"], what: "Edit" },
      { keys: ["⌫"], what: "Delete…" }
    ]
  });
</script>

<input aria-label="Search" />
{#if layer}
  <Layer label="Filters">
    {#snippet trigger({ props })}<button {...props}>Filter</button>{/snippet}
    <p>Panel body</p>
  </Layer>
{/if}
<table>
  <tbody>
    {#each items as item (item.id)}
      {@const menu = keys.menu(item)}
      <tr class={ROW_CLASS} {...keys.row(item)} onclick={() => log(`click ${item.name}`)}>
        <td>{item.name}</td>
        <td>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger aria-label="Actions for {item.name}">⋮</DropdownMenu.Trigger>
            <DropdownMenu.Content {...menu.content}>
              <DropdownMenu.Item onSelect={() => log(`edit ${item.name}`)}>
                Edit
                {#if keys.enabled}<DropdownMenu.Shortcut
                    ><KeyCap size="sm" key="E" /></DropdownMenu.Shortcut
                  >{/if}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </td>
      </tr>
    {/each}
  </tbody>
</table>
<ShortcutsSheet />
