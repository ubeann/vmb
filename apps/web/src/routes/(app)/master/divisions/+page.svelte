<!--
  The Divisions list, the pilot of the list kit (#301) that Roles, Users and
  the domain modules compose from: search, filter chips, an All · Trash switch,
  sortable columns, paging and a columns menu, with the whole state in the URL.
  Actions follow the caller's permissions; the API refuses the same things.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { navigating, page } from "$app/state";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import HeroIcon from "$lib/components/HeroIcon.svelte";
  import Notice from "$lib/components/Notice.svelte";
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
  import { postRowAction } from "$lib/components/list/row-action.js";
  import SortableHead from "$lib/components/list/SortableHead.svelte";
  import { Button, buttonVariants } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { listHref } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import type { Division, PermissionKey } from "@vmb/types";
  import Building2Icon from "@lucide/svelte/icons/building-2";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchXIcon from "@lucide/svelte/icons/search-x";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  const base = "/master/divisions";
  const actionPath = resolve(base);

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

  const columns = new ColumnVisibility("divisions", [
    { id: "name", label: "Name", hideable: false },
    { id: "code", label: "Code" },
    { id: "description", label: "Description" },
    { id: "status", label: "Status" },
    { id: "updatedAt", label: "Updated" },
    { id: "createdAt", label: "Created", hidden: true }
  ]);
  onMount(() => columns.restore());

  const can = (permission: PermissionKey) => data.permissions.includes(permission);

  const inTrash = $derived(data.query.trashed === "only");
  const filtered = $derived(
    Boolean(data.query.search || data.query.updated || data.query.created) ||
      data.query.status.length > 0
  );
  const sort = $derived({ sort: data.query.sort, dir: data.query.dir });
  // a search, filter, sort or page change on this list, still loading
  const loading = $derived(navigating.to?.url.pathname === page.url.pathname);

  let confirmOpen = $state(false);
  let target = $state<Division | null>(null);
  let deleting = $state(false);

  function askDelete(division: Division) {
    target = division;
    confirmOpen = true;
  }

  async function restore(division: Division) {
    const result = await postRowAction(`${actionPath}?/restore`, division.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${division.name} restored`);
    await invalidateAll();
  }

  const submitDelete: SubmitFunction = () => {
    const division = target;
    deleting = true;
    return async ({ result, update }) => {
      deleting = false;
      if (result.type === "failure") {
        toast.error(String(result.data?.error ?? "Something went wrong. Please try again."));
        return;
      }
      confirmOpen = false;
      if (result.type === "success" && division) {
        toast.success(`${division.name} moved to Trash`, {
          duration: 10_000,
          action: can("master-divisions.restore")
            ? { label: "Undo", onClick: () => restore(division) }
            : undefined
        });
      }
      await update();
    };
  };
</script>

<svelte:head>
  <title>Divisions — VMB</title>
</svelte:head>

<Page width="default" class="flex flex-col gap-5">
  <PageHeader
    title="Divisions"
    description="A User belongs to one or more Divisions through the Roles they hold."
  >
    {#snippet action()}
      {#if can("master-divisions.create")}
        <Button href={resolve("/master/divisions/new")}>
          <PlusIcon aria-hidden="true" data-icon="inline-start" />New division
        </Button>
      {/if}
    {/snippet}
  </PageHeader>

  <ListTabs {base} label="Division views" trashCount={data.trashCount} countNoun="divisions" />

  <ListToolbar {base} searchLabel="Search divisions" filters={FILTERS}>
    {#snippet actions()}
      <ColumnsMenu {columns} />
    {/snippet}
  </ListToolbar>

  {#if !data.divisions}
    <Notice variant="destructive">Could not load divisions. Please try again.</Notice>
  {:else}
    {@const list = data.divisions}
    <div
      class="border-border bg-card relative overflow-hidden rounded-xl border"
      aria-busy={loading}
    >
      {#if loading}
        <p
          role="status"
          class="bg-card text-muted-foreground border-border absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-full border px-3 py-1 text-sm shadow-sm"
        >
          Loading…
        </p>
      {/if}

      {#if list.items.length === 0}
        {#if list.total > 0}
          <EmptyState
            title="Nothing on this page"
            description="The list is shorter than this page number."
          >
            <a
              href={resolve(listHref(base, page.url.searchParams, { page: 1 }))}
              class={buttonVariants({ variant: "outline" })}>Go to the first page</a
            >
          </EmptyState>
        {:else if filtered}
          <EmptyState
            icon={SearchXIcon}
            title="No divisions match"
            description="Try another search, or clear the filters to see every division."
          >
            <a
              href={resolve(
                listHref(base, page.url.searchParams, {
                  search: null,
                  status: null,
                  updated: null,
                  created: null
                })
              )}
              class={buttonVariants({ variant: "outline" })}>Clear search and filters</a
            >
          </EmptyState>
        {:else if inTrash}
          <EmptyState
            icon={Trash2Icon}
            title="The Trash is empty"
            description="A division you delete waits here until you restore it."
          />
        {:else}
          <EmptyState
            icon={Building2Icon}
            title="No divisions yet"
            description="Divisions group the company's Roles and Users."
          >
            {#if can("master-divisions.create")}
              <Button href={resolve("/master/divisions/new")}>
                <PlusIcon aria-hidden="true" data-icon="inline-start" />New division
              </Button>
            {/if}
          </EmptyState>
        {/if}
      {:else}
        <Table.Root class={cn("transition-opacity", loading && "opacity-50")}>
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
              {#if inTrash}
                <Table.Head scope="col" class={columnClass("utility")}>Deleted</Table.Head>
              {/if}
              {#if columns.visible("updatedAt")}
                <SortableHead
                  {base}
                  column="updatedAt"
                  label="Updated"
                  current={sort}
                  class={columnClass("utility")}
                />
              {/if}
              {#if columns.visible("createdAt")}
                <SortableHead
                  {base}
                  column="createdAt"
                  label="Created"
                  current={sort}
                  class={columnClass("utility")}
                />
              {/if}
              <!-- pinned at the right as Name is at the left, so a scrolled table keeps its actions in view -->
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
                    <a
                      href={resolve("/(app)/master/divisions/[id]", { id: division.id })}
                      class="truncate font-medium hover:underline">{division.name}</a
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
                {#if inTrash}
                  <Table.Cell class={columnClass("utility")}
                    ><RecordTime iso={division.deletedAt} /></Table.Cell
                  >
                {/if}
                {#if columns.visible("updatedAt")}
                  <Table.Cell class={columnClass("utility")}
                    ><RecordTime iso={division.updatedAt} /></Table.Cell
                  >
                {/if}
                {#if columns.visible("createdAt")}
                  <Table.Cell class={columnClass("utility")}
                    ><RecordTime iso={division.createdAt} /></Table.Cell
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
                        <Button {...props} data-slot="button" variant="ghost" size="sm">
                          <span class="max-sm:sr-only">Actions</span><span class="sr-only">
                            for {division.name}</span
                          >
                          <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
                        </Button>
                      {/snippet}
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end" class="w-40">
                      <DropdownMenu.Item>
                        {#snippet child({ props })}
                          <a
                            {...props}
                            href={resolve("/(app)/master/divisions/[id]", { id: division.id })}
                            >View</a
                          >
                        {/snippet}
                      </DropdownMenu.Item>
                      {#if division.deletedAt}
                        {#if can("master-divisions.restore")}
                          <DropdownMenu.Item onSelect={() => restore(division)}>
                            Restore
                          </DropdownMenu.Item>
                        {/if}
                      {:else}
                        {#if can("master-divisions.update")}
                          <DropdownMenu.Item>
                            {#snippet child({ props })}
                              <a
                                {...props}
                                href={resolve("/(app)/master/divisions/[id]/edit", {
                                  id: division.id
                                })}>Edit</a
                              >
                            {/snippet}
                          </DropdownMenu.Item>
                        {/if}
                        {#if can("master-divisions.delete")}
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            variant="destructive"
                            onSelect={() => askDelete(division)}
                          >
                            Delete…
                          </DropdownMenu.Item>
                        {/if}
                      {/if}
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
  {/if}
</Page>

<Dialog.Root bind:open={confirmOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Delete {target?.name}?</Dialog.Title>
      <Dialog.Description>It moves to the Trash. You can restore it from Trash.</Dialog.Description>
    </Dialog.Header>
    <form method="POST" action="?/delete" use:enhance={submitDelete}>
      <input type="hidden" name="id" value={target?.id ?? ""} />
      <Dialog.Footer>
        <Dialog.Close>
          {#snippet child({ props })}
            <Button {...props} data-slot="button" variant="outline">Cancel</Button>
          {/snippet}
        </Dialog.Close>
        <Button type="submit" variant="destructive" disabled={deleting}>
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
