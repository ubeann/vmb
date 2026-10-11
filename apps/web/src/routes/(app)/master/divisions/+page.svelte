<!--
  The Divisions list, the pilot of the list kit (#301) that Roles, Users and
  the domain modules compose from: search, filter chips, an All · Trash switch,
  sortable columns, paging and a View panel, with the whole state in the URL.
  Actions follow the caller's permissions; the API refuses the same things.
  Rows, row actions and the Trash follow ADR-0051 rules 7 to 9.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { navigating, page } from "$app/state";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RecordTime from "$lib/components/RecordTime.svelte";
  import StatusPill from "$lib/components/StatusPill.svelte";
  import { ColumnVisibility } from "$lib/components/list/column-visibility.svelte.js";
  import { columnClass, TEXT_CAP } from "$lib/components/list/columns.js";
  import type { ListFilter } from "$lib/components/list/FilterChips.svelte";
  import ListFooter from "$lib/components/list/ListFooter.svelte";
  import ListToolbar from "$lib/components/list/ListToolbar.svelte";
  import Marked from "$lib/components/list/Marked.svelte";
  import RecordTile from "$lib/components/list/RecordTile.svelte";
  import { postRowAction } from "$lib/components/list/row-action.js";
  import {
    opensRecord,
    PINNED_BG_CLASS,
    ROW_ACTION_CLASS,
    ROW_CLASS,
    ROW_MENU_CLASS,
    ROW_MENU_TRIGGER_CLASS
  } from "$lib/components/list/rows.js";
  import SortableHead from "$lib/components/list/SortableHead.svelte";
  import ViewPanel from "$lib/components/list/ViewPanel.svelte";
  import { DATE_ORDER, TEXT_ORDER, type SortField } from "$lib/components/list/view.js";
  import { Button, buttonVariants } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { listHref } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import { DivisionListQuerySchema, type Division, type PermissionKey } from "@vmb/types";
  import Building2Icon from "@lucide/svelte/icons/building-2";
  import CircleDotIcon from "@lucide/svelte/icons/circle-dot";
  import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import PowerIcon from "@lucide/svelte/icons/power";
  import PowerOffIcon from "@lucide/svelte/icons/power-off";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import SearchXIcon from "@lucide/svelte/icons/search-x";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import type { SubmitFunction } from "@sveltejs/kit";
  import type { Component } from "svelte";
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
      icon: CircleDotIcon,
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
    { id: "updatedAt", label: "Updated" },
    { id: "createdAt", label: "Created", hidden: true }
  ]);
  onMount(() => columns.restore());

  // the sort the list has with nothing in the URL
  const defaultSort = DivisionListQuerySchema.parse({});

  // what the tabs' counts and the footer count, each agreeing with its number
  const NOUNS = {
    all: { one: "division", many: "divisions" },
    trash: { one: "deleted division", many: "deleted divisions" }
  };

  const can = (permission: PermissionKey) => data.permissions.includes(permission);

  const inTrash = $derived(data.query.trashed === "only");
  const filtered = $derived(
    Boolean(data.query.search || data.query.updated || data.query.created) ||
      data.query.status.length > 0
  );
  const sort = $derived({ sort: data.query.sort, dir: data.query.dir });
  // what narrow cards sort by in the View panel; a deleted division's last update is its deletion
  const sortFields = $derived<SortField[]>([
    { sort: "name", label: "Name", ...TEXT_ORDER },
    { sort: "code", label: "Code", ...TEXT_ORDER },
    {
      sort: "updatedAt",
      label: inTrash ? "Date deleted" : "Last updated",
      ...DATE_ORDER
    }
  ]);
  // a search, filter, sort or page change on this list, still loading
  const loading = $derived(navigating.to?.url.pathname === page.url.pathname);

  let confirmOpen = $state(false);
  let target = $state<Division | null>(null);
  let deleting = $state(false);

  function askDelete(division: Division) {
    target = division;
    confirmOpen = true;
  }

  // row actions run one after another, so an Undo clicked while another request is in flight
  // waits its turn rather than overtaking it, or being dropped
  let queue: Promise<unknown> = Promise.resolve();
  const inOrder = <T,>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task);
    queue = next.catch(() => {});
    return next;
  };

  const restore = (division: Division) =>
    inOrder(async () => {
      const result = await postRowAction(`${actionPath}?/restore`, division.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${division.name} restored`);
      await invalidateAll();
    });

  /** Activate or Deactivate through the status-only endpoints; the toast's Undo puts it back (without an Undo of its own). */
  const setActive = (division: Division, active: boolean, undoable = true) =>
    inOrder(async () => {
      const result = await postRowAction(
        `${actionPath}?/${active ? "activate" : "deactivate"}`,
        division.id
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${division.name} ${active ? "activated" : "deactivated"}`, {
        duration: 10_000,
        action: undoable
          ? { label: "Undo", onClick: () => setActive(division, !active, false) }
          : undefined
      });
      await invalidateAll();
    });

  type RowAction = {
    key: string;
    label: string;
    icon: Component<{ "aria-hidden"?: "true"; "data-icon"?: string }>;
    /** Opens the record's edit page instead of running something. */
    edit?: boolean;
    destructive?: boolean;
    run?: () => void;
  };

  // ADR-0051 rule 8: a row gets a menu only for two or more of these; one is a button
  function rowActions(division: Division): RowAction[] {
    if (division.deletedAt) {
      return can("master-divisions.restore")
        ? [
            {
              key: "restore",
              label: "Restore",
              icon: RotateCcwIcon,
              run: () => restore(division)
            }
          ]
        : [];
    }
    const actions: RowAction[] = [];
    if (can("master-divisions.update")) {
      actions.push({
        key: "edit",
        label: "Edit",
        icon: PencilIcon,
        edit: true
      });
      actions.push(
        division.isActive
          ? {
              key: "deactivate",
              label: "Deactivate",
              icon: PowerOffIcon,
              run: () => setActive(division, false)
            }
          : {
              key: "activate",
              label: "Activate",
              icon: PowerIcon,
              run: () => setActive(division, true)
            }
      );
    }
    if (can("master-divisions.delete")) {
      actions.push({
        key: "delete",
        label: "Delete…",
        icon: Trash2Icon,
        destructive: true,
        run: () => askDelete(division)
      });
    }
    return actions;
  }

  // a click anywhere on a row opens the record; the name stays a real link for a new tab (ADR-0051 rule 7)
  function openRow(event: MouseEvent, division: Division) {
    if (!opensRecord(event)) return;
    void goto(resolve("/(app)/master/divisions/[id]", { id: division.id }));
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
  <PageHeader title="Divisions" description="Organisational units that group stock and budgets.">
    {#snippet action()}
      {#if can("master-divisions.create")}
        <Button href={resolve("/master/divisions/new")}>
          <PlusIcon aria-hidden="true" data-icon="inline-start" />New division
        </Button>
      {/if}
    {/snippet}
  </PageHeader>

  <div class="border-border bg-card relative overflow-hidden rounded-xl border" aria-busy={loading}>
    <ListToolbar
      {base}
      viewsLabel="Division views"
      countNouns={NOUNS}
      views={data.divisions ? data.divisions.views : null}
      searchLabel="Search divisions"
      searchPlaceholder="Search name, code or description"
      searchShortPlaceholder="Search divisions"
      filters={FILTERS}
    >
      {#snippet actions()}
        <ViewPanel
          {base}
          {columns}
          perPage={data.query.perPage}
          {sort}
          {defaultSort}
          {sortFields}
          shown={data.divisions ? data.divisions.total : null}
          noun={inTrash ? NOUNS.trash : NOUNS.all}
        />
      {/snippet}
    </ListToolbar>

    {#if !data.divisions}
      <div class="p-4">
        <Notice variant="destructive">Could not load divisions. Please try again.</Notice>
      </div>
    {:else}
      {@const list = data.divisions}
      {#if loading}
        <p
          role="status"
          class="bg-card text-muted-foreground border-border absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1 text-sm shadow-sm"
        >
          Loading…
        </p>
      {/if}

      {#if inTrash}
        <p
          class="border-border text-muted-foreground flex items-center gap-2 border-b px-3 py-2.5 text-sm"
        >
          <HistoryIcon aria-hidden="true" class="size-4 shrink-0" />
          Deleted divisions stay here for the audit trail. Restore one to use it again.
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
            description="A division you delete waits here, and you can restore it at any time."
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
              <Table.Row class={ROW_CLASS} onclick={(event) => openRow(event, division)}>
                <Table.Cell
                  class={cn(
                    PINNED_BG_CLASS,
                    "pinned-start sticky left-0 z-10 max-w-72",
                    columnClass("identity")
                  )}
                >
                  <div class="flex items-center gap-2.5">
                    <RecordTile iconName={division.iconName} colorHex={division.colorHex} />
                    <a
                      href={resolve("/(app)/master/divisions/[id]", { id: division.id })}
                      class="truncate font-medium hover:underline"
                      ><Marked text={division.name} term={data.query.search} /></a
                    >
                    {#if !division.isActive}
                      <!-- only the exception is marked; there is no Status column (ADR-0051 rule 7) -->
                      <StatusPill status="Inactive" class="shrink-0" />
                    {/if}
                  </div>
                </Table.Cell>
                {#if columns.visible("code")}
                  <Table.Cell class={cn("font-mono text-xs", columnClass("utility"))}
                    ><Marked text={division.code} term={data.query.search} /></Table.Cell
                  >
                {/if}
                {#if columns.visible("description")}
                  <Table.Cell class={cn("text-muted-foreground", columnClass("text"))}>
                    <span class={TEXT_CAP} title={division.description ?? undefined}
                      ><Marked text={division.description ?? "—"} term={data.query.search} /></span
                    >
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
                    PINNED_BG_CLASS,
                    "pinned-end sticky right-0 z-10 text-right",
                    columnClass("utility")
                  )}
                >
                  {@const actions = rowActions(division)}
                  {#if actions.length === 1}
                    {@const only = actions[0]!}
                    {#if only.edit}
                      <a
                        href={resolve("/(app)/master/divisions/[id]/edit", { id: division.id })}
                        data-slot="button"
                        aria-label="{only.label.replace('…', '')} {division.name}"
                        class={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          ROW_ACTION_CLASS
                        )}
                      >
                        <only.icon aria-hidden="true" data-icon="inline-start" />{only.label}
                      </a>
                    {:else}
                      <Button
                        variant="ghost"
                        size="sm"
                        class={ROW_ACTION_CLASS}
                        aria-label="{only.label.replace('…', '')} {division.name}"
                        onclick={only.run}
                      >
                        <only.icon aria-hidden="true" data-icon="inline-start" />{only.label}
                      </Button>
                    {/if}
                  {:else if actions.length > 1}
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger>
                        {#snippet child({ props })}
                          <Button
                            {...props}
                            data-slot="button"
                            variant="ghost"
                            size="icon"
                            class={cn(ROW_ACTION_CLASS, ROW_MENU_TRIGGER_CLASS)}
                            aria-label="Actions for {division.name}"
                          >
                            <EllipsisVerticalIcon aria-hidden="true" />
                          </Button>
                        {/snippet}
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content align="end" class={ROW_MENU_CLASS}>
                        {#each actions as action, index (action.key)}
                          {#if action.destructive && index > 0}
                            <DropdownMenu.Separator />
                          {/if}
                          {#if action.edit}
                            <DropdownMenu.Item>
                              {#snippet child({ props })}
                                <a
                                  {...props}
                                  href={resolve("/(app)/master/divisions/[id]/edit", {
                                    id: division.id
                                  })}><action.icon aria-hidden="true" />{action.label}</a
                                >
                              {/snippet}
                            </DropdownMenu.Item>
                          {:else}
                            <DropdownMenu.Item
                              variant={action.destructive ? "destructive" : "default"}
                              onSelect={action.run}
                            >
                              <action.icon aria-hidden="true" />{action.label}
                            </DropdownMenu.Item>
                          {/if}
                        {/each}
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  {/if}
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    {/if}
  </div>

  {#if data.divisions}
    <ListFooter
      {base}
      list={data.divisions}
      noun={inTrash ? NOUNS.trash : NOUNS.all}
      outOf={data.outOf}
      nameCount={inTrash}
    />
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
