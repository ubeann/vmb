<!-- PROTOTYPE (prototype/list-kit): variant A, today's Divisions list on the real kit, over fixtures. -->
<script lang="ts">
  import EmptyState from "$lib/components/EmptyState.svelte";
  import HeroIcon from "$lib/components/HeroIcon.svelte";
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RecordTime from "$lib/components/RecordTime.svelte";
  import StatusPill from "$lib/components/StatusPill.svelte";
  import ColumnsMenu from "$lib/components/list/ColumnsMenu.svelte";
  import { ColumnVisibility } from "$lib/components/list/column-visibility.svelte.js";
  import { columnClass, TEXT_CAP } from "$lib/components/list/columns.js";
  import type { ListFilter } from "$lib/components/list/FilterChips.svelte";
  import ListFooter from "$lib/components/list/ListFooter.svelte";
  import ListTabs from "$lib/components/list/ListTabs.svelte";
  import ListToolbar from "$lib/components/list/ListToolbar.svelte";
  import SortableHead from "$lib/components/list/SortableHead.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import type { MasterListPathname } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchXIcon from "@lucide/svelte/icons/search-x";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  const base = "/prototype/list-kit" as MasterListPathname;
  const FILTERS: ListFilter[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" }
      ]
    }
  ];
  const columns = new ColumnVisibility("prototype-divisions-a", [
    { id: "name", label: "Name", hideable: false },
    { id: "code", label: "Code" },
    { id: "description", label: "Description" },
    { id: "status", label: "Status" },
    { id: "updatedAt", label: "Updated" }
  ]);
  onMount(() => columns.restore());

  const inTrash = $derived(data.query.trashed === "only");
  const sort = $derived({ sort: data.query.sort, dir: data.query.dir });
  const stub = (what: string) => () => toast.info(`Prototype: ${what}`);
</script>

<Page width="default" class="flex flex-col gap-5">
  <PageHeader
    title="Divisions"
    description="A User belongs to one or more Divisions through the Roles they hold."
  >
    {#snippet action()}
      <Button onclick={stub("New division")}>
        <PlusIcon aria-hidden="true" data-icon="inline-start" />New division
      </Button>
    {/snippet}
  </PageHeader>

  <ListTabs {base} label="Division views" trashCount={data.trashCount} countNoun="divisions" />

  <ListToolbar {base} searchLabel="Search divisions" filters={FILTERS}>
    {#snippet actions()}
      <ColumnsMenu {columns} />
    {/snippet}
  </ListToolbar>

  {@const list = data.divisions}
  <div class="border-border bg-card relative overflow-hidden rounded-lg border">
    {#if list.items.length === 0}
      <EmptyState icon={SearchXIcon} title="No divisions match" description="Try another search." />
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row class="hover:bg-transparent">
            <SortableHead
              {base}
              column="name"
              label="Name"
              current={sort}
              class={cn("bg-card pinned-start sticky left-0 z-10", columnClass("identity"))}
            />
            {#if columns.visible("code")}
              <SortableHead
                {base}
                column="code"
                label="Code"
                current={sort}
                class={columnClass("utility")}
              />
            {/if}
            {#if columns.visible("description")}
              <Table.Head scope="col" class={columnClass("text")}>Description</Table.Head>
            {/if}
            {#if columns.visible("status")}
              <Table.Head scope="col" class={columnClass("utility")}>Status</Table.Head>
            {/if}
            {#if columns.visible("updatedAt")}
              <SortableHead
                {base}
                column="updatedAt"
                label={inTrash ? "Deleted" : "Updated"}
                current={sort}
                class={columnClass("utility")}
              />
            {/if}
            <Table.Head
              scope="col"
              class={cn("bg-card pinned-end sticky right-0 z-10", columnClass("utility"))}
              ><span class="sr-only">Actions</span></Table.Head
            >
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each list.items as division (division.id)}
            <Table.Row class="hover:bg-muted">
              <Table.Cell
                class={cn(
                  "bg-card [tr:hover>&]:bg-muted pinned-start sticky left-0 z-10 max-w-64",
                  columnClass("identity")
                )}
              >
                <div class="flex items-center gap-2.5">
                  <span
                    class="flex size-7 shrink-0 items-center justify-center rounded-md text-white"
                    style:background-color={division.colorHex}
                  >
                    <HeroIcon name={division.iconName} class="size-4" />
                  </span>
                  <a href="#{division.code}" class="truncate font-medium hover:underline"
                    >{division.name}</a
                  >
                </div>
              </Table.Cell>
              {#if columns.visible("code")}
                <Table.Cell class={cn("font-mono text-xs", columnClass("utility"))}
                  >{division.code}</Table.Cell
                >
              {/if}
              {#if columns.visible("description")}
                <Table.Cell class={cn("text-muted-foreground", columnClass("text"))}>
                  <span class={TEXT_CAP} title={division.description ?? undefined}
                    >{division.description ?? "—"}</span
                  >
                </Table.Cell>
              {/if}
              {#if columns.visible("status")}
                <Table.Cell class={columnClass("utility")}>
                  <StatusPill status={division.isActive ? "Active" : "Inactive"} />
                </Table.Cell>
              {/if}
              {#if columns.visible("updatedAt")}
                <Table.Cell class={columnClass("utility")}
                  ><RecordTime
                    iso={inTrash ? division.deletedAt : division.updatedAt}
                  /></Table.Cell
                >
              {/if}
              <Table.Cell
                class={cn(
                  "bg-card [tr:hover>&]:bg-muted pinned-end sticky right-0 z-10 text-right",
                  columnClass("utility")
                )}
              >
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <Button {...props} variant="ghost" size="sm">
                        <span class="max-sm:sr-only">Actions</span><span class="sr-only">
                          for {division.name}</span
                        >
                        <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
                      </Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end" class="w-40">
                    <DropdownMenu.Item onSelect={stub(`View ${division.name}`)}
                      >View</DropdownMenu.Item
                    >
                    <DropdownMenu.Item onSelect={stub(`Edit ${division.name}`)}
                      >Edit</DropdownMenu.Item
                    >
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item
                      variant="destructive"
                      onSelect={stub(`Delete ${division.name}`)}>Delete…</DropdownMenu.Item
                    >
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  </div>

  <ListFooter {base} {list} noun={inTrash ? "divisions in the Trash" : "divisions"} />
</Page>
