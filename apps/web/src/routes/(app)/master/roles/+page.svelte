<!--
  The Roles list on the list kit (#303), composed as Divisions is (#301): search,
  filter chips, sortable columns, paging and a View panel, with the whole state
  in the URL. Roles have no Trash, so there is no All · Trash switch and
  deleting is permanent: the dialog says so, and no Undo follows. A System Role
  carries a lock badge, and its row offers View alone, since nobody can edit or
  delete one. Actions follow the caller's permissions; the API refuses the same
  things. Keyboard rows (ADR-0052 rule 4) are wired but off, as Divisions ships.
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
  import DeleteRoleDialog from "$lib/master/DeleteRoleDialog.svelte";
  import RoleForm from "$lib/master/RoleForm.svelte";
  import RoleView from "$lib/master/RoleView.svelte";
  import SystemBadge from "$lib/master/SystemBadge.svelte";
  import type { RoleDraft } from "$lib/master/appearance.js";
  import type { RoleFormFields } from "$lib/master/form-data.js";
  import { listHref } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import { RoleListQuerySchema, type PermissionKey, type Role, type RoleDetail } from "@vmb/types";
  import CalendarClockIcon from "@lucide/svelte/icons/calendar-clock";
  import CalendarPlusIcon from "@lucide/svelte/icons/calendar-plus";
  import CircleDotIcon from "@lucide/svelte/icons/circle-dot";
  import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchXIcon from "@lucide/svelte/icons/search-x";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import type { Component } from "svelte";
  import { onMount } from "svelte";
  import { mergeProps } from "bits-ui";
  import { toast } from "svelte-sonner";
  import type { SuperValidated } from "sveltekit-superforms";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  // the folded second line joins its parts explicitly: a template would drop the edge spaces
  const SEP = " · ";
  const SPACE = " ";

  const base = "/master/roles";
  const actionPath = resolve(base);

  // a record opens in a layer over the list, at its own URL (#303); the list keeps its own
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

  const columns = new ColumnVisibility("roles", [
    { id: "name", label: "Name", hideable: false },
    { id: "description", label: "Description" },
    { id: "updatedAt", label: "Updated" },
    { id: "createdAt", label: "Created", hidden: true }
  ]);
  onMount(() => columns.restore());

  // the sort the list has with nothing in the URL
  const defaultSort = RoleListQuerySchema.parse({});

  // what the footer counts, agreeing with its number
  const NOUN = { one: "role", many: "roles" };

  const can = (permission: PermissionKey) => data.permissions.includes(permission);

  const filtered = $derived(
    Boolean(data.query.search || data.query.updated || data.query.created) ||
      data.query.status.length > 0
  );
  const sort = $derived({ sort: data.query.sort, dir: data.query.dir });
  // what narrow cards sort by in the View panel
  const sortFields: SortField[] = [
    { sort: "name", label: "Name", ...TEXT_ORDER },
    { sort: "updatedAt", label: "Last updated", ...DATE_ORDER },
    { sort: "createdAt", label: "Created", ...DATE_ORDER }
  ];
  // a search, filter, sort or page change on this list, still loading
  const loading = $derived(navigating.to?.url.pathname === page.url.pathname);

  type RoleTarget = Pick<Role, "id" | "name" | "colorHex" | "iconName">;
  let confirmOpen = $state(false);
  let target = $state<RoleTarget | null>(null);
  // the layer asks in a dialog of its own, inside its focus trap
  let confirmInLayer = $state(false);

  function askDelete(role: RoleTarget) {
    target = role;
    confirmOpen = true;
  }

  const recordHref = (id: string) => resolve("/(app)/master/roles/[id]", { id });
  const editHref = (id: string) => resolve("/(app)/master/roles/[id]/edit", { id });
  const newHref = resolve("/master/roles/new");

  // what each of the layer's pages gets from its load
  type ViewData = { role: RoleDetail; permissions: string[] };
  type EditData = { role: RoleDetail; form: SuperValidated<RoleFormFields> };
  type NewData = { form: SuperValidated<RoleFormFields> };

  // the entry the layer last showed, kept while it animates out
  let shown = $state.raw(layer.shown);
  $effect.pre(() => {
    if (layer.shown) shown = layer.shown;
  });

  // a form in the layer reports what it holds, which the layer's header shows as it changes
  let draft = $state.raw<RoleDraft | null>(null);

  const layerLabel = $derived.by(() => {
    if (!shown) return "";
    if (shown.kind === "new") return "New role";
    const { role } = shown.data as ViewData;
    return shown.kind === "edit" ? `Edit ${role.name}` : role.name;
  });

  function saved(kind: LayerKind, role: RoleFormFields) {
    layer.closeNow();
    toast.success(kind === "new" ? `${role.name} created` : `${role.name} saved`);
    void invalidateAll();
  }

  // each action's key, which the row menus show and the shortcut sheet lists (ADR-0052)
  const KEYS = {
    edit: "E",
    delete: "Backspace"
  } as const;

  type RowAction = {
    key: string;
    /** The keyboard row's key for it (ADR-0052 rule 4); View has none, Enter opens the row. */
    shortcut?: string;
    label: string;
    icon: Component<{ "aria-hidden"?: "true"; "data-icon"?: string }>;
    /** Opens one of the record's pages instead of running something. */
    opens?: Exclude<LayerKind, "new">;
    destructive?: boolean;
    run?: () => void;
  };

  // ADR-0051 rule 8: a row gets a menu only for two or more of these; one is a button.
  // A System Role is never edited or deleted, so it has View alone.
  function rowActions(role: Role): RowAction[] {
    const actions: RowAction[] = [];
    if (!role.isSystem && can("master-roles.update")) {
      actions.push({
        key: "edit",
        shortcut: KEYS.edit,
        label: "Edit",
        icon: PencilIcon,
        opens: "edit",
        run: () => void layer.open(editHref(role.id), "edit", activeElement())
      });
    }
    if (!role.isSystem && can("master-roles.delete")) {
      actions.push({
        key: "delete",
        shortcut: KEYS.delete,
        label: "Delete…",
        icon: Trash2Icon,
        destructive: true,
        run: () => askDelete(role)
      });
    }
    // what a row has when it can't be changed: only to look
    if (actions.length === 0 && can("master-roles.view")) {
      actions.push({
        key: "view",
        label: "View",
        icon: EyeIcon,
        opens: "view",
        run: () => void layer.open(recordHref(role.id), "view", activeElement())
      });
    }
    return actions;
  }

  const rowKeys = new RowKeys<Role>({
    title: "Roles",
    items: () => data.roles?.items ?? [],
    open: (role) => void layer.open(recordHref(role.id), "view", activeElement()),
    actions: (role) => rowActions(role).map(({ shortcut: key, run }) => ({ key, run })),
    help: [
      { keys: [KEYS.edit], what: "Edit", single: true },
      { keys: [KEYS.delete], what: "Delete…", single: true }
    ]
  });

  // what a row folded to two lines says under its name, following the columns the user shows
  function metaParts(role: Role) {
    const parts: ("inactive" | "changed" | "created")[] = [];
    if (!role.isActive) parts.push("inactive");
    if (columns.visible("updatedAt")) parts.push("changed");
    if (columns.visible("createdAt")) parts.push("created");
    return parts;
  }

  const activeElement = () =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  // A click anywhere on a row opens the record in the layer; the name stays a
  // real link for a new tab (ADR-0051 rule 7). Focus comes back to the name.
  function openRow(event: MouseEvent, role: Role) {
    if (!opensRecord(event)) return;
    const row = event.currentTarget as HTMLElement;
    void layer.open(recordHref(role.id), "view", row.querySelector("a"));
  }

  /** The name, an Edit link or New, clicked plainly: its page opens in the layer. */
  function openLink(event: MouseEvent, kind: LayerKind) {
    if (!plainClick(event)) return;
    event.preventDefault();
    const link = event.currentTarget as HTMLAnchorElement;
    void layer.open(link.pathname, kind, link);
  }

  // a Role has no Trash, so the toast has nothing to undo
  function deleted(role: Pick<Role, "id" | "name">) {
    if (layer.shown) layer.closeNow();
    toast.success(`${role.name} deleted`);
  }
</script>

<svelte:head>
  <title>Roles — VMB</title>
</svelte:head>

<!-- a row menu shows each action's key once keyboard rows are on (ADR-0052 rule 4) -->
{#snippet keyHint(action: RowAction)}
  {#if rowKeys.keys && action.shortcut}
    <!-- the cap is drawn only; the item names its key with aria-keyshortcuts -->
    <DropdownMenu.Shortcut aria-hidden="true"
      ><KeyCap size="sm" key={action.shortcut} /></DropdownMenu.Shortcut
    >
  {/if}
{/snippet}

<Page width="default" class="flex flex-col gap-4">
  <PageHeader title="Roles" description="Named sets of permissions that you give to users.">
    {#snippet action()}
      {#if can("master-roles.create")}
        <Button href={newHref} onclick={(event: MouseEvent) => openLink(event, "new")}>
          <PlusIcon aria-hidden="true" data-icon="inline-start" />New role
        </Button>
      {/if}
    {/snippet}
  </PageHeader>

  <ListCard busy={loading}>
    <ListToolbar
      {base}
      countNouns={{ all: NOUN }}
      facets={data.roles ? data.roles.facets : null}
      total={data.roles ? data.roles.total : null}
      searchLabel="Search roles"
      searchPlaceholder="Search name or description"
      searchShortPlaceholder="Search roles"
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

    {#if !data.roles}
      <div class="p-4">
        <Notice variant="destructive">Could not load roles. Please try again.</Notice>
      </div>
    {:else}
      {@const list = data.roles}
      {#if loading}
        <p
          role="status"
          class="bg-card text-muted-foreground border-border absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1 text-sm shadow-sm"
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
            title="No roles match"
            description="Try another search, or clear the filters to see every role."
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
        {:else}
          <EmptyState
            icon={KeyRoundIcon}
            title="No roles yet"
            description="A role is a named bundle of permissions granted to users, optionally scoped to one division."
          >
            {#if can("master-roles.create")}
              <Button href={newHref} onclick={(event: MouseEvent) => openLink(event, "new")}>
                <PlusIcon aria-hidden="true" data-icon="inline-start" />New role
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
              {#if columns.visible("description")}
                <Table.Head scope="col" class={columnClass("text")}>Description</Table.Head>
              {/if}
              {#if columns.visible("updatedAt")}
                <SortableHead
                  {base}
                  column="updatedAt"
                  label="Updated"
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
            {#each list.items as role (role.id)}
              <Table.Row
                class={ROW_CLASS}
                onclick={(event) => openRow(event, role)}
                {...layer.preloadOn(recordHref(role.id))}
                {...rowKeys.row(role)}
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
                      iconName={role.iconName}
                      colorHex={role.colorHex}
                      class={!role.isActive ? INACTIVE_TILE_CLASS : undefined}
                    />
                    <div class="flex min-w-0 flex-col @max-lg/list:gap-0.5">
                      <div class="flex min-w-0 items-center gap-2.5">
                        <a
                          href={resolve("/(app)/master/roles/[id]", { id: role.id })}
                          onclick={(event) => openLink(event, "view")}
                          class={cn(
                            "truncate font-medium hover:underline",
                            !role.isActive && INACTIVE_NAME_CLASS
                          )}><Marked text={role.name} term={data.query.search} /></a
                        >
                        {#if role.isSystem}
                          <SystemBadge class="shrink-0" />
                        {/if}
                        {#if !role.isActive}
                          <!-- only the exception is marked; there is no Status column (ADR-0051 rule 7) -->
                          <StatusPill
                            status="Inactive"
                            class={cn("shrink-0", INACTIVE_PILL_CLASS)}
                          />
                        {/if}
                      </div>
                      <!-- what the folded columns stand in for, under the name (ADR-0051 rule 11) -->
                      {#if columns.visible("description") && role.description}
                        <p class={TEXT_LINE} title={role.description}>
                          <Marked text={role.description} term={data.query.search} />
                        </p>
                      {/if}
                      <p class={META_LINE}>
                        {#each metaParts(role) as part, index (part)}
                          {#if index > 0}{SEP}{/if}
                          {#if part === "inactive"}
                            <span class="text-foreground/80 font-medium">Inactive</span>
                          {:else if part === "changed"}
                            Updated{SPACE}<RecordTime day iso={role.updatedAt} />
                          {:else}
                            Created{SPACE}<RecordTime day iso={role.createdAt} />
                          {/if}
                        {/each}
                      </p>
                    </div>
                  </div>
                </Table.Cell>
                {#if columns.visible("description")}
                  <Table.Cell class={cn("text-muted-foreground", columnClass("text"))}>
                    <span class={TEXT_TRUNCATE} title={role.description ?? undefined}
                      ><Marked text={role.description ?? "—"} term={data.query.search} /></span
                    >
                  </Table.Cell>
                {/if}
                {#if columns.visible("updatedAt")}
                  <Table.Cell class={columnClass("meta")}
                    ><RecordTime iso={role.updatedAt} /></Table.Cell
                  >
                {/if}
                {#if columns.visible("createdAt")}
                  <Table.Cell class={columnClass("meta")}
                    ><RecordTime iso={role.createdAt} /></Table.Cell
                  >
                {/if}
                <Table.Cell
                  class={cn(
                    PINNED_BG_CLASS,
                    "pinned-end sticky right-0 z-10 text-right",
                    columnClass("utility")
                  )}
                >
                  {@const actions = rowActions(role)}
                  {#if actions.length === 1}
                    {@const only = actions[0]!}
                    {#if only.opens}
                      <a
                        href={only.opens === "edit"
                          ? resolve("/(app)/master/roles/[id]/edit", { id: role.id })
                          : resolve("/(app)/master/roles/[id]", { id: role.id })}
                        onclick={(event) => openLink(event, only.opens!)}
                        data-slot="button"
                        aria-label="{only.label.replace('…', '')} {role.name}"
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
                        aria-label="{only.label.replace('…', '')} {role.name}"
                        onclick={only.run}
                      >
                        <only.icon aria-hidden="true" data-icon="inline-start" />{only.label}
                      </Button>
                    {/if}
                  {:else if actions.length > 1}
                    {@const menu = rowKeys.menu(role)}
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger>
                        {#snippet child({ props })}
                          <Button
                            {...props}
                            data-slot="button"
                            variant="ghost"
                            size="icon"
                            class={cn(ROW_ACTION_CLASS, ROW_MENU_TRIGGER_CLASS)}
                            aria-label="Actions for {role.name}"
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
                          {#if action.opens}
                            {@const opens = action.opens}
                            <DropdownMenu.Item>
                              {#snippet child({ props })}
                                <!-- the menu's own click handler runs first, to select the item and close the menu -->
                                <a
                                  {...mergeProps(props, {
                                    onclick: (event: MouseEvent) => openLink(event, opens)
                                  })}
                                  aria-keyshortcuts={rowKeys.keys ? action.shortcut : undefined}
                                  href={opens === "edit"
                                    ? resolve("/(app)/master/roles/[id]/edit", { id: role.id })
                                    : resolve("/(app)/master/roles/[id]", { id: role.id })}
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

  {#if data.roles}
    <ListFooter {base} list={data.roles} noun={NOUN} outOf={data.outOf} />
  {/if}
</Page>

<DeleteRoleDialog
  bind:open={confirmOpen}
  {target}
  action="{actionPath}?/delete"
  ondeleted={deleted}
/>

<RecordLayer
  open={layer.shown !== null}
  label={layerLabel}
  badge={shown?.kind === "edit" ? "edit" : shown?.kind === "new" ? "new" : undefined}
  onclose={() => void layer.close()}
  returnFocus={layer.returnFocus}
>
  {#snippet title()}
    <span class="truncate">{layerLabel}</span>
    {#if shown?.kind === "view" && (shown.data as ViewData).role.isSystem}
      <SystemBadge class="shrink-0" />
    {/if}
  {/snippet}
  {#snippet tile()}
    {#if shown?.kind === "view"}
      {@const { role } = shown.data as ViewData}
      <RecordTile iconName={role.iconName} colorHex={role.colorHex} />
    {:else if draft}
      <!-- the form's colour and icon as they are picked -->
      <RecordTile iconName={draft.iconName} colorHex={draft.colorHex} />
    {/if}
  {/snippet}
  {#snippet subtitle()}
    {#if shown?.kind === "view"}
      {@const { role } = shown.data as ViewData}
      {role.isActive ? "Active" : "Inactive"}
    {:else if shown?.kind === "edit"}
      {#if draft?.dirty}
        <!-- the edits Cancel or Esc would ask about, marked so they are not missed -->
        <span class="text-foreground inline-flex items-center gap-1.5 font-medium"
          ><span aria-hidden="true" class="size-1.5 rounded-full bg-amber-500"></span>Unsaved
          changes</span
        >
      {:else}
        No changes yet
      {/if}
    {:else}
      Not saved yet
    {/if}
  {/snippet}
  {#if shown}
    <!-- a fresh load of the same page (a conflict's Reload) starts its form afresh -->
    {#key shown}
      {#if shown.kind === "view"}
        {@const { role, permissions } = shown.data as ViewData}
        <RoleView
          {role}
          {permissions}
          onedit={() => void layer.open(editHref(role.id), "edit")}
          ondelete={() => (confirmInLayer = true)}
        />
        <DeleteRoleDialog
          bind:open={confirmInLayer}
          target={role}
          action="{actionPath}?/delete"
          ondeleted={deleted}
        />
      {:else if shown.kind === "edit"}
        {@const { role, form } = shown.data as EditData}
        <RoleForm
          {form}
          action={editHref(role.id)}
          reloadHref={editHref(role.id)}
          onreload={() => void layer.refresh()}
          oncancel={() => void layer.close()}
          onsaved={(record) => saved("edit", record)}
          ondraft={(next) => (draft = next)}
        />
      {:else}
        {@const { form } = shown.data as NewData}
        <RoleForm
          {form}
          action={newHref}
          submitLabel="Create role"
          submitIcon={PlusIcon}
          pendingLabel="Creating…"
          oncancel={() => void layer.close()}
          onsaved={(record) => saved("new", record)}
          ondraft={(next) => (draft = next)}
        />
      {/if}
    {/key}
  {/if}
</RecordLayer>
