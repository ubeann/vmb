<!--
  The Divisions list, the pilot of the list kit (#301) that Roles, Users and
  the domain modules compose from: search, filter chips, an All · Trash switch,
  sortable columns, paging and a View panel, with the whole state in the URL.
  Actions follow the caller's permissions; the API refuses the same things.
  Rows, row actions and the Trash follow ADR-0051 rules 7 to 9, and the card
  answers to its own width (rule 11): the description folds under the name below
  42rem, and below 32rem rows are two lines with no header row. Keyboard rows
  (ADR-0052 rule 4) are wired but off, as Divisions ships.
-->
<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { navigating } from "$app/state";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import KeyCap from "$lib/components/KeyCap.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RecordTime from "$lib/components/RecordTime.svelte";
  import StatusPill from "$lib/components/StatusPill.svelte";
  import { ColumnVisibility } from "$lib/components/list/column-visibility.svelte.js";
  import { LayerRoute } from "$lib/components/list/layer/layer-route.svelte.js";
  import RecordLayer from "$lib/components/list/layer/RecordLayer.svelte";
  import { listPage, provideListUrl } from "$lib/components/list/list-url.svelte.js";
  import { columnClass, TEXT_TRUNCATE } from "$lib/components/list/columns.js";
  import type { ListFilter } from "$lib/components/list/FilterChips.svelte";
  import ListCard from "$lib/components/list/ListCard.svelte";
  import ListFooter from "$lib/components/list/ListFooter.svelte";
  import ListToolbar from "$lib/components/list/ListToolbar.svelte";
  import Marked from "$lib/components/list/Marked.svelte";
  import RecordTile from "$lib/components/list/RecordTile.svelte";
  import { postRowAction } from "$lib/components/list/row-action.js";
  import { RowKeys } from "$lib/components/list/row-keys.svelte.js";
  import {
    INACTIVE_NAME_CLASS,
    INACTIVE_PILL_CLASS,
    INACTIVE_TILE_CLASS,
    META_LINE,
    opensRecord,
    plainClick,
    PINNED_BG_CLASS,
    ROW_ACTION_CLASS,
    ROW_CLASS,
    ROW_MARK_CLASS,
    ROW_MENU_CLASS,
    ROW_MENU_TRIGGER_CLASS,
    TEXT_LINE
  } from "$lib/components/list/rows.js";
  import SortableHead from "$lib/components/list/SortableHead.svelte";
  import ViewPanel from "$lib/components/list/ViewPanel.svelte";
  import { DATE_ORDER, TEXT_ORDER, type SortField } from "$lib/components/list/view.js";
  import { Button, buttonVariants } from "$lib/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import DeleteDivisionDialog from "$lib/master/DeleteDivisionDialog.svelte";
  import DivisionForm from "$lib/master/DivisionForm.svelte";
  import DivisionView from "$lib/master/DivisionView.svelte";
  import type { DivisionFormFields } from "$lib/master/form-data.js";
  import { listHref } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import {
    DivisionListQuerySchema,
    type Division,
    type DivisionDetail,
    type PermissionKey
  } from "@vmb/types";
  import Building2Icon from "@lucide/svelte/icons/building-2";
  import CalendarClockIcon from "@lucide/svelte/icons/calendar-clock";
  import CalendarPlusIcon from "@lucide/svelte/icons/calendar-plus";
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
  import type { Component } from "svelte";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import type { SuperValidated } from "sveltekit-superforms";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  // the folded second line joins its parts explicitly: a template would drop the edge spaces
  const SEP = " · ";
  const SPACE = " ";

  const base = "/master/divisions";
  const actionPath = resolve(base);

  // a record opens in a layer over the list, at its own URL (#302); the list keeps its own
  provideListUrl(actionPath);
  const page = listPage();
  // the record's three pages, as the layer shows them
  type LayerKind = "view" | "edit" | "new";
  const layer = new LayerRoute<LayerKind>();

  const FILTERS: ListFilter[] = [
    {
      key: "status",
      label: "Status",
      icon: CircleDotIcon,
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" }
      ]
    },
    { kind: "date", key: "updated", label: "Updated", icon: CalendarClockIcon },
    { kind: "date", key: "created", label: "Created", icon: CalendarPlusIcon }
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
  let target = $state<Pick<Division, "id" | "name"> | null>(null);
  // the layer asks in a dialog of its own, inside its focus trap
  let confirmInLayer = $state(false);

  function askDelete(division: Pick<Division, "id" | "name">) {
    target = division;
    confirmOpen = true;
  }

  const recordHref = (id: string) => resolve("/(app)/master/divisions/[id]", { id });
  const editHref = (id: string) => resolve("/(app)/master/divisions/[id]/edit", { id });
  const newHref = resolve("/master/divisions/new");

  // what each of the layer's pages gets from its load
  type ViewData = { division: DivisionDetail; permissions: string[] };
  type EditData = { division: DivisionDetail; form: SuperValidated<DivisionFormFields> };
  type NewData = { form: SuperValidated<DivisionFormFields> };

  // the entry the layer last showed, kept while it animates out
  let shown = $state.raw(layer.shown);
  $effect.pre(() => {
    if (layer.shown) shown = layer.shown;
  });

  const layerLabel = $derived.by(() => {
    if (!shown) return "";
    if (shown.kind === "new") return "New division";
    const { division } = shown.data as ViewData;
    return shown.kind === "edit" ? `Edit ${division.name}` : division.name;
  });

  function saved(kind: LayerKind, division: DivisionFormFields) {
    layer.closeNow();
    toast.success(kind === "new" ? `${division.name} created` : `${division.name} saved`);
    void invalidateAll();
  }

  // row actions run one after another, so an Undo clicked while another request is in flight
  // waits its turn rather than overtaking it, or being dropped
  let queue: Promise<unknown> = Promise.resolve();
  const inOrder = <T,>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task);
    queue = next.catch(() => {});
    return next;
  };

  const restore = (division: Pick<Division, "id" | "name">) =>
    inOrder(async () => {
      const result = await postRowAction(`${actionPath}?/restore`, division.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${division.name} restored`);
      // the layer showing it in the Trash shows it live again
      if (layer.shown?.kind === "view") await layer.refresh();
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

  // each action's key, which the row menus show and the shortcut sheet lists (ADR-0052)
  const KEYS = {
    edit: "E",
    deactivate: "D",
    activate: "A",
    delete: "Backspace",
    restore: "R"
  } as const;

  type RowAction = {
    key: string;
    /** The keyboard row's key for it (ADR-0052 rule 4). */
    shortcut: string;
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
              shortcut: KEYS.restore,
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
        shortcut: KEYS.edit,
        label: "Edit",
        icon: PencilIcon,
        edit: true,
        run: () => void layer.open(editHref(division.id), "edit", activeElement())
      });
      actions.push(
        division.isActive
          ? {
              key: "deactivate",
              shortcut: KEYS.deactivate,
              label: "Deactivate",
              icon: PowerOffIcon,
              run: () => setActive(division, false)
            }
          : {
              key: "activate",
              shortcut: KEYS.activate,
              label: "Activate",
              icon: PowerIcon,
              run: () => setActive(division, true)
            }
      );
    }
    if (can("master-divisions.delete")) {
      actions.push({
        key: "delete",
        shortcut: KEYS.delete,
        label: "Delete…",
        icon: Trash2Icon,
        destructive: true,
        run: () => askDelete(division)
      });
    }
    return actions;
  }

  const rowKeys = new RowKeys<Division>({
    title: "Divisions",
    items: () => data.divisions?.items ?? [],
    open: (division) => void layer.open(recordHref(division.id), "view", activeElement()),
    actions: (division) => rowActions(division).map(({ shortcut: key, run }) => ({ key, run })),
    help: [
      { keys: [KEYS.edit], what: "Edit", single: true },
      { keys: [KEYS.deactivate], what: "Deactivate", single: true },
      { keys: [KEYS.activate], what: "Activate", single: true },
      { keys: [KEYS.delete], what: "Delete…", single: true },
      { keys: [KEYS.restore], what: "Restore, in the Trash", single: true }
    ]
  });

  // what a row folded to two lines says under its name, following the columns the user shows
  // (the Trash always says when it was deleted, as its column does)
  function metaParts(division: Division) {
    const parts: ("inactive" | "code" | "changed" | "created")[] = [];
    if (!division.isActive) parts.push("inactive");
    if (columns.visible("code")) parts.push("code");
    if (inTrash || columns.visible("updatedAt")) parts.push("changed");
    if (columns.visible("createdAt")) parts.push("created");
    return parts;
  }

  const activeElement = () =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  // A click anywhere on a row opens the record in the layer; the name stays a
  // real link for a new tab (ADR-0051 rule 7). Focus comes back to the name.
  function openRow(event: MouseEvent, division: Division) {
    if (!opensRecord(event)) return;
    const row = event.currentTarget as HTMLElement;
    void layer.open(recordHref(division.id), "view", row.querySelector("a"));
  }

  /** The name, an Edit link or New, clicked plainly: its page opens in the layer. */
  function openLink(event: MouseEvent, kind: LayerKind) {
    if (!plainClick(event)) return;
    event.preventDefault();
    const link = event.currentTarget as HTMLAnchorElement;
    void layer.open(link.pathname, kind, link);
  }

  function deleted(division: Pick<Division, "id" | "name">) {
    if (layer.shown) layer.closeNow();
    toast.success(`${division.name} moved to Trash`, {
      duration: 10_000,
      action: can("master-divisions.restore")
        ? { label: "Undo", onClick: () => restore(division) }
        : undefined
    });
  }
</script>

<svelte:head>
  <title>Divisions — VMB</title>
</svelte:head>

<!-- a row menu shows each action's key once keyboard rows are on (ADR-0052 rule 4) -->
{#snippet keyHint(action: RowAction)}
  {#if rowKeys.keys}
    <!-- the cap is drawn only; the item names its key with aria-keyshortcuts -->
    <DropdownMenu.Shortcut aria-hidden="true"
      ><KeyCap size="sm" key={action.shortcut} /></DropdownMenu.Shortcut
    >
  {/if}
{/snippet}

<Page width="default" class="flex flex-col gap-4">
  <PageHeader title="Divisions" description="Organisational units that group stock and budgets.">
    {#snippet action()}
      {#if can("master-divisions.create")}
        <Button href={newHref} onclick={(event: MouseEvent) => openLink(event, "new")}>
          <PlusIcon aria-hidden="true" data-icon="inline-start" />New division
        </Button>
      {/if}
    {/snippet}
  </PageHeader>

  <ListCard busy={loading}>
    <ListToolbar
      {base}
      viewsLabel="Division views"
      countNouns={NOUNS}
      facets={data.divisions ? data.divisions.facets : null}
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
            description="Divisions group warehouse items and expense budgets."
          >
            {#if can("master-divisions.create")}
              <Button href={newHref} onclick={(event: MouseEvent) => openLink(event, "new")}>
                <PlusIcon aria-hidden="true" data-icon="inline-start" />New division
              </Button>
            {/if}
          </EmptyState>
        {/if}
      {:else}
        <Table.Root class={cn("transition-opacity", loading && "opacity-50")}>
          <!-- under 32rem the header row goes; sorting is in View (ADR-0051 rule 11) -->
          <Table.Header class="@max-lg/list:hidden">
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
                  class={columnClass("meta")}
                />
              {/if}
              {#if columns.visible("description")}
                <Table.Head scope="col" class={columnClass("text")}>Description</Table.Head>
              {/if}
              <!-- deleting stamps updatedAt too, so the Trash has one date: Deleted, sorted on that stamp -->
              {#if inTrash || columns.visible("updatedAt")}
                <SortableHead
                  {base}
                  column="updatedAt"
                  label={inTrash ? "Deleted" : "Updated"}
                  current={sort}
                  class={columnClass("meta")}
                />
              {/if}
              {#if columns.visible("createdAt")}
                <SortableHead
                  {base}
                  column="createdAt"
                  label="Created"
                  current={sort}
                  class={columnClass("meta")}
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
              <Table.Row
                class={ROW_CLASS}
                onclick={(event) => openRow(event, division)}
                {...rowKeys.row(division)}
              >
                <Table.Cell
                  class={cn(
                    PINNED_BG_CLASS,
                    rowKeys.enabled && ROW_MARK_CLASS,
                    "pinned-start sticky left-0 z-10 max-w-72",
                    columnClass("identity")
                  )}
                >
                  <div class="flex items-center gap-2.5">
                    <RecordTile
                      iconName={division.iconName}
                      colorHex={division.colorHex}
                      class={!division.isActive ? INACTIVE_TILE_CLASS : undefined}
                    />
                    <div class="flex min-w-0 flex-col @max-lg/list:gap-0.5">
                      <div class="flex min-w-0 items-center gap-2.5">
                        <a
                          href={resolve("/(app)/master/divisions/[id]", { id: division.id })}
                          onclick={(event) => openLink(event, "view")}
                          class={cn(
                            "truncate font-medium hover:underline",
                            !division.isActive && INACTIVE_NAME_CLASS
                          )}><Marked text={division.name} term={data.query.search} /></a
                        >
                        {#if !division.isActive}
                          <!-- only the exception is marked; there is no Status column (ADR-0051 rule 7) -->
                          <StatusPill
                            status="Inactive"
                            class={cn("shrink-0", INACTIVE_PILL_CLASS)}
                          />
                        {/if}
                      </div>
                      <!-- what the folded columns stand in for, under the name (ADR-0051 rule 11) -->
                      {#if columns.visible("description") && division.description}
                        <p class={TEXT_LINE} title={division.description}>
                          <Marked text={division.description} term={data.query.search} />
                        </p>
                      {/if}
                      <p class={META_LINE}>
                        {#each metaParts(division) as part, index (part)}
                          {#if index > 0}{SEP}{/if}
                          {#if part === "inactive"}
                            <span class="text-foreground/80 font-medium">Inactive</span>
                          {:else if part === "code"}
                            <span class="font-mono"
                              ><Marked text={division.code} term={data.query.search} /></span
                            >
                          {:else if part === "changed"}
                            {inTrash ? "Deleted" : "Updated"}{SPACE}<RecordTime
                              day
                              iso={inTrash ? division.deletedAt : division.updatedAt}
                            />
                          {:else}
                            Created{SPACE}<RecordTime day iso={division.createdAt} />
                          {/if}
                        {/each}
                      </p>
                    </div>
                  </div>
                </Table.Cell>
                {#if columns.visible("code")}
                  <Table.Cell class={cn("font-mono text-xs", columnClass("meta"))}
                    ><Marked text={division.code} term={data.query.search} /></Table.Cell
                  >
                {/if}
                {#if columns.visible("description")}
                  <Table.Cell class={cn("text-muted-foreground", columnClass("text"))}>
                    <span class={TEXT_TRUNCATE} title={division.description ?? undefined}
                      ><Marked text={division.description ?? "—"} term={data.query.search} /></span
                    >
                  </Table.Cell>
                {/if}
                {#if inTrash || columns.visible("updatedAt")}
                  <Table.Cell class={columnClass("meta")}
                    ><RecordTime
                      iso={inTrash ? division.deletedAt : division.updatedAt}
                    /></Table.Cell
                  >
                {/if}
                {#if columns.visible("createdAt")}
                  <Table.Cell class={columnClass("meta")}
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
                        onclick={(event) => openLink(event, "edit")}
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
                    {@const menu = rowKeys.menu(division)}
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
                      <DropdownMenu.Content align="end" class={ROW_MENU_CLASS} {...menu.content}>
                        {#each actions as action, index (action.key)}
                          {#if action.destructive && index > 0}
                            <DropdownMenu.Separator />
                          {/if}
                          {#if action.edit}
                            <DropdownMenu.Item>
                              {#snippet child({ props })}
                                <a
                                  {...props}
                                  aria-keyshortcuts={rowKeys.keys ? action.shortcut : undefined}
                                  href={resolve("/(app)/master/divisions/[id]/edit", {
                                    id: division.id
                                  })}
                                  onclick={(event) => openLink(event, "edit")}
                                  ><action.icon aria-hidden="true" />{action.label}{@render keyHint(
                                    action
                                  )}</a
                                >
                              {/snippet}
                            </DropdownMenu.Item>
                          {:else}
                            <DropdownMenu.Item
                              variant={action.destructive ? "destructive" : "default"}
                              aria-keyshortcuts={rowKeys.keys ? action.shortcut : undefined}
                              onSelect={action.run}
                            >
                              <action.icon aria-hidden="true" />{action.label}{@render keyHint(
                                action
                              )}
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
  </ListCard>

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

<DeleteDivisionDialog
  bind:open={confirmOpen}
  {target}
  action="{actionPath}?/delete"
  ondeleted={deleted}
/>

<RecordLayer
  open={layer.shown !== null}
  label={layerLabel}
  onclose={() => void layer.close()}
  returnFocus={layer.returnFocus}
>
  {#snippet title()}
    {#if shown?.kind === "view"}
      {@const { division } = shown.data as ViewData}
      <RecordTile iconName={division.iconName} colorHex={division.colorHex} />
      <span class="truncate">{division.name}</span>
    {:else}
      <span class="truncate">{layerLabel}</span>
    {/if}
  {/snippet}
  {#if shown}
    <!-- a fresh load of the same page (a Restore, a conflict's Reload) starts its form afresh -->
    {#key shown}
      {#if shown.kind === "view"}
        {@const { division, permissions } = shown.data as ViewData}
        <DivisionView
          {division}
          {permissions}
          onedit={() => void layer.open(editHref(division.id), "edit")}
          ondelete={() => (confirmInLayer = true)}
          onrestore={() => void restore(division)}
        />
        <DeleteDivisionDialog
          bind:open={confirmInLayer}
          target={division}
          action="{actionPath}?/delete"
          ondeleted={deleted}
        />
      {:else if shown.kind === "edit"}
        {@const { division, form } = shown.data as EditData}
        <DivisionForm
          {form}
          action={editHref(division.id)}
          reloadHref={editHref(division.id)}
          onreload={() => void layer.refresh()}
          oncancel={() => void layer.close()}
          onsaved={(record) => saved("edit", record)}
        />
      {:else}
        {@const { form } = shown.data as NewData}
        <DivisionForm
          {form}
          action={newHref}
          submitLabel="Create division"
          pendingLabel="Creating…"
          oncancel={() => void layer.close()}
          onsaved={(record) => saved("new", record)}
        />
      {/if}
    {/key}
  {/if}
</RecordLayer>
