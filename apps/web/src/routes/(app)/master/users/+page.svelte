<!--
  The Users list on the list kit (#304), composed as Divisions is (#301): search,
  filter chips, an All · Trash switch, sortable columns, paging and a View panel,
  with the whole state in the URL. A User opens on a full page, not a layer
  (their form has three sections and a password), so a row, its name and its
  actions are links. Rows, row actions and the Trash follow ADR-0051 rules 7 to 9.

  The identity cell is the column that stays when rows fold (rule 11): the
  avatar, the name and under it the email. There is no Status column: only the
  exceptions are marked, a Suspended or Inactive pill after the name, and Active
  shows nothing (rule 7). A user's Division is whichever their roles are scoped
  to. Under 32rem the second line leads with the status word, then the email,
  then what the hidden columns hold. Delete asks first and moves the user to
  the Trash, with an Undo; their sessions end with it. A user holding permissions the
  caller lacks is out of their reach (`withinReach`, from the API): the row offers View
  alone, and bulk selection skips it and says so, since the API would refuse each change
  with 403 `PERMISSION_ESCALATION`.
-->
<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { navigating } from "$app/state";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import KeyCap from "$lib/components/KeyCap.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RecordTime from "$lib/components/RecordTime.svelte";
  import StatusPill from "$lib/components/StatusPill.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import { ColumnVisibility } from "$lib/components/list/column-visibility.svelte.js";
  import { columnClass, TEXT_TRUNCATE } from "$lib/components/list/columns.js";
  import type { ListFilter } from "$lib/components/list/FilterChips.svelte";
  import ListCard from "$lib/components/list/ListCard.svelte";
  import ListFooter from "$lib/components/list/ListFooter.svelte";
  import { listPage, provideListUrl } from "$lib/components/list/list-url.svelte.js";
  import ListBulkBar from "$lib/components/list/ListBulkBar.svelte";
  import SelectPageStrip from "$lib/components/list/SelectPageStrip.svelte";
  import { Selection } from "$lib/components/list/selection.svelte.js";
  import ListToolbar from "$lib/components/list/ListToolbar.svelte";
  import Marked from "$lib/components/list/Marked.svelte";
  import { postBulkAction, postRowAction } from "$lib/components/list/row-action.js";
  import { RowKeys } from "$lib/components/list/row-keys.svelte.js";
  import {
    INACTIVE_NAME_CLASS,
    INACTIVE_PILL_CLASS,
    INACTIVE_TILE_CLASS,
    META_LINE,
    opensRecord,
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
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import BulkDeleteDialog from "$lib/master/BulkDeleteDialog.svelte";
  import DeleteUserDialog from "$lib/master/DeleteUserDialog.svelte";
  import { listHref } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import {
    USER_STATUS_LABELS,
    UserListQuerySchema,
    type PermissionKey,
    type User,
    type UserStatus
  } from "@vmb/types";
  import CalendarClockIcon from "@lucide/svelte/icons/calendar-clock";
  import CalendarPlusIcon from "@lucide/svelte/icons/calendar-plus";
  import BadgeCheckIcon from "@lucide/svelte/icons/badge-check";
  import Building2Icon from "@lucide/svelte/icons/building-2";
  import CircleDotIcon from "@lucide/svelte/icons/circle-dot";
  import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import SearchXIcon from "@lucide/svelte/icons/search-x";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import UsersIcon from "@lucide/svelte/icons/users";
  import type { Component } from "svelte";
  import { onMount, untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  // the folded second line joins its parts explicitly: a template would drop the edge spaces
  const SEP = " · ";
  const SPACE = " ";

  const base = "/master/users";
  const actionPath = resolve(base);

  provideListUrl(actionPath);
  const page = listPage();

  // the Status filter's options, in the order the URL keeps them
  const STATUS_OPTIONS = (["active", "inactive", "suspended"] as const).map((value) => ({
    value,
    label: USER_STATUS_LABELS[value]
  }));

  const filters = $derived<ListFilter[]>([
    { key: "status", label: "Status", icon: CircleDotIcon, options: STATUS_OPTIONS },
    {
      key: "division",
      label: "Division",
      icon: Building2Icon,
      options: data.divisions.map((division) => ({ value: division.id, label: division.name }))
    },
    {
      key: "role",
      label: "Role",
      icon: KeyRoundIcon,
      options: data.roles.map((role) => ({ value: role.id, label: role.name }))
    },
    { kind: "date", key: "updated", label: "Updated", icon: CalendarClockIcon },
    { kind: "date", key: "created", label: "Created", icon: CalendarPlusIcon }
  ]);

  // a Division or Role with nobody in it has no count from the API, and says 0 rather than nothing
  const facets = $derived(
    data.users
      ? {
          status: data.users.facets.status,
          division: Object.fromEntries(
            data.divisions.map((division) => [
              division.id,
              data.users?.facets.division[division.id] ?? 0
            ])
          ),
          role: Object.fromEntries(
            data.roles.map((role) => [role.id, data.users?.facets.role[role.id] ?? 0])
          )
        }
      : null
  );

  const columns = new ColumnVisibility("users", [
    { id: "name", label: "Name", hideable: false },
    { id: "division", label: "Division" },
    { id: "roles", label: "Roles" },
    { id: "verified", label: "Verified" },
    { id: "updatedAt", label: "Updated", hidden: true },
    { id: "createdAt", label: "Created", hidden: true }
  ]);
  onMount(() => columns.restore());

  // the sort the list has with nothing in the URL
  const defaultSort = UserListQuerySchema.parse({});

  // what the tabs' counts and the footer count, each agreeing with its number
  const NOUNS = {
    all: { one: "user", many: "users" },
    trash: { one: "deleted user", many: "deleted users" }
  };

  const can = (permission: PermissionKey) => data.permissions.includes(permission);

  const inTrash = $derived(data.query.trashed === "only");
  const filtered = $derived(
    Boolean(data.query.search || data.query.updated || data.query.created) ||
      data.query.status.length > 0 ||
      data.query.division.length > 0 ||
      data.query.role.length > 0
  );
  const sort = $derived({ sort: data.query.sort, dir: data.query.dir });
  // what narrow cards sort by in the View panel; a deleted user's last update is their deletion
  const sortFields = $derived<SortField[]>([
    { sort: "name", label: "Name", ...TEXT_ORDER },
    { sort: "email", label: "Email", ...TEXT_ORDER },
    {
      sort: "updatedAt",
      label: inTrash ? "Date deleted" : "Last updated",
      ...DATE_ORDER
    },
    { sort: "createdAt", label: "Created", ...DATE_ORDER }
  ]);
  // a search, filter, sort or page change on this list, still loading
  const loading = $derived(navigating.to?.url.pathname === page.url.pathname);

  // Rows chosen for a bulk action (#305): the current page's only, and gone once the page, the
  // filters or the sort change, or the rows do
  const selection = new Selection();
  const pageIds = $derived(data.users?.items.map((user) => user.id) ?? []);
  // the rows a bulk action may take: those within the caller's reach; the others are skipped
  const reachableIds = $derived(
    data.users?.items.filter((user) => user.withinReach).map((user) => user.id) ?? []
  );
  const skipped = $derived(pageIds.length - reachableIds.length);
  // the bulk actions check the `_any` keys, as legacy's did (#467)
  const selectable = $derived(
    inTrash ? can("master-users.restore_any") : can("master-users.delete_any")
  );
  const pageState = $derived(selection.stateOf(reachableIds));
  $effect.pre(() => {
    void page.url.search;
    untrack(() => selection.clear());
  });
  $effect.pre(() => {
    const rows = pageIds;
    untrack(() => selection.keep(rows));
  });
  // the select-all box: the header's, or under 32rem (no header row) the strip's
  let headerBox = $state<HTMLElement | null>(null);
  let stripBox = $state<HTMLElement | null>(null);
  function focusSelectAll() {
    // the one that is shown has a layout box
    [headerBox, stripBox].find((box) => box && box.offsetParent !== null)?.focus();
  }
  // the rows a delete asks about, kept while the dialog closes after the selection is gone
  let bulkIds = $state<string[]>([]);
  let bulkOpen = $state(false);

  const manyUsers = (n: number) => `${n} ${n === 1 ? "user" : "users"}`;

  function askBulkDelete() {
    bulkIds = selection.ids;
    bulkOpen = true;
  }

  function clearSelection() {
    selection.clear();
    focusSelectAll();
  }

  function bulkDeleted(ids: string[]) {
    selection.clear();
    toast.success(`${manyUsers(ids.length)} moved to Trash`, {
      duration: 10_000,
      action: can("master-users.restore_any")
        ? { label: "Undo", onClick: () => restoreMany(ids) }
        : undefined
    });
  }

  type UserTarget = Pick<User, "id" | "name" | "email" | "profilePhotoPath">;
  let confirmOpen = $state(false);
  let target = $state<UserTarget | null>(null);

  function askDelete(user: UserTarget) {
    target = user;
    confirmOpen = true;
  }

  const newHref = resolve("/master/users/new");

  // restores run one after another, so an Undo clicked while another request is in flight
  // waits its turn rather than overtaking it, or being dropped
  let queue: Promise<unknown> = Promise.resolve();
  const inOrder = <T,>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task);
    queue = next.catch(() => {});
    return next;
  };

  /** Restore several in one request: the Trash's bulk Restore, and the Undo of a bulk delete. */
  const restoreMany = (ids: string[]) =>
    inOrder(async () => {
      const result = await postBulkAction(`${actionPath}?/bulk`, { action: "restore", ids });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      selection.clear();
      toast.success(`${manyUsers(ids.length)} restored`);
      await invalidateAll();
      focusSelectAll();
    });

  const restore = (user: Pick<User, "id" | "name">) =>
    inOrder(async () => {
      const result = await postRowAction(`${actionPath}?/restore`, user.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${user.name} restored`);
      await invalidateAll();
    });

  // each action's key, which the row menus show and the shortcut sheet lists (ADR-0052)
  const KEYS = {
    edit: "E",
    delete: "Backspace",
    restore: "R"
  } as const;

  type RowAction = {
    key: string;
    /** The keyboard row's key for it (ADR-0052 rule 4); View has none, Enter opens the row. */
    shortcut?: string;
    label: string;
    icon: Component<{ "aria-hidden"?: "true"; "data-icon"?: string }>;
    /** Goes to one of the user's pages instead of running something. */
    href?: string;
    destructive?: boolean;
    run?: () => void;
  };

  // ADR-0051 rule 8: a row gets a menu only for two or more of these; one is a button
  function rowActions(user: User): RowAction[] {
    const actions: RowAction[] = [];
    // a user out of the caller's reach is only to look at: the API refuses every change
    if (user.withinReach) {
      if (user.deletedAt) {
        if (can("master-users.restore")) {
          actions.push({
            key: "restore",
            shortcut: KEYS.restore,
            label: "Restore",
            icon: RotateCcwIcon,
            run: () => restore(user)
          });
        }
      } else {
        if (can("master-users.update")) {
          actions.push({
            key: "edit",
            shortcut: KEYS.edit,
            label: "Edit",
            icon: PencilIcon,
            href: resolve("/(app)/master/users/[id]/edit", { id: user.id }),
            run: () => void goto(resolve("/(app)/master/users/[id]/edit", { id: user.id }))
          });
        }
        if (can("master-users.delete")) {
          actions.push({
            key: "delete",
            shortcut: KEYS.delete,
            label: "Delete…",
            icon: Trash2Icon,
            destructive: true,
            run: () => askDelete(user)
          });
        }
      }
    }
    // what a row has when nothing can be changed: only to look
    if (actions.length === 0 && can("master-users.view")) {
      actions.push({
        key: "view",
        label: "View",
        icon: EyeIcon,
        href: resolve("/(app)/master/users/[id]", { id: user.id }),
        run: () => void goto(resolve("/(app)/master/users/[id]", { id: user.id }))
      });
    }
    return actions;
  }

  const rowKeys = new RowKeys<User>({
    title: "Users",
    items: () => data.users?.items ?? [],
    open: (user) => void goto(resolve("/(app)/master/users/[id]", { id: user.id })),
    actions: (user) => rowActions(user).map(({ shortcut: key, run }) => ({ key, run })),
    help: [
      { keys: [KEYS.edit], what: "Edit", single: true },
      { keys: [KEYS.delete], what: "Delete…", single: true },
      { keys: [KEYS.restore], what: "Restore, in the Trash", single: true }
    ]
  });

  const divisionNames = (user: User) => user.divisions.map((division) => division.name).join(", ");
  const roleNames = (user: User) => user.roles.map((role) => role.name).join(", ");

  // what a row folded to two lines says under its name, following the columns the user shows
  // (the Trash always says when it was deleted, as its column does)
  function metaParts(user: User) {
    const parts: ("status" | "email" | "division" | "changed" | "created")[] = [];
    if (user.status !== "active") parts.push("status");
    parts.push("email");
    if (columns.visible("division") && user.divisions.length > 0) parts.push("division");
    if (inTrash || columns.visible("updatedAt")) parts.push("changed");
    if (columns.visible("createdAt")) parts.push("created");
    return parts;
  }

  // A click anywhere on a row opens the user; the name stays a real link for a new tab
  // (ADR-0051 rule 7).
  function openRow(event: MouseEvent, user: User) {
    if (!opensRecord(event)) return;
    void goto(resolve("/(app)/master/users/[id]", { id: user.id }));
  }

  function deleted(user: Pick<User, "id" | "name">) {
    toast.success(`${user.name} moved to Trash`, {
      duration: 10_000,
      action: can("master-users.restore")
        ? { label: "Undo", onClick: () => restore(user) }
        : undefined
    });
  }

  // the exceptions only: Active has no pill (ADR-0051 rule 7)
  const pillFor = (status: UserStatus) =>
    status === "suspended" ? "Suspended" : status === "inactive" ? "Inactive" : null;
</script>

<svelte:head>
  <title>Users — VMB</title>
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
  <PageHeader title="Users" description="The people who sign in to VMB, and what they may do.">
    {#snippet action()}
      {#if can("master-users.create")}
        <Button href={newHref}>
          <PlusIcon aria-hidden="true" data-icon="inline-start" />New user
        </Button>
      {/if}
    {/snippet}
  </PageHeader>

  <ListCard busy={loading}>
    {#if selection.count > 0}
      <ListBulkBar
        count={selection.count}
        label="Bulk actions for users"
        note={skipped > 0
          ? `${skipped} skipped: you don't hold every permission they hold`
          : undefined}
        onclear={clearSelection}
      >
        {#if inTrash}
          <Button type="button" onclick={() => restoreMany(selection.ids)}>
            <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />Restore
          </Button>
        {:else}
          <Button type="button" variant="outline" onclick={askBulkDelete}>
            <Trash2Icon aria-hidden="true" data-icon="inline-start" />Delete…
          </Button>
        {/if}
      </ListBulkBar>
    {:else}
      <ListToolbar
        {base}
        viewsLabel="User views"
        countNouns={NOUNS}
        {facets}
        views={data.users ? data.users.views : null}
        searchLabel="Search users"
        searchPlaceholder="Search name, email or phone"
        searchShortPlaceholder="Search users"
        {filters}
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
    {/if}

    {#if !data.users}
      <div class="p-4">
        <Notice variant="destructive">Could not load users. Please try again.</Notice>
      </div>
    {:else}
      {@const list = data.users}
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
          Deleted users stay here for the audit trail. Restore one to let them sign in again.
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
            title="No users match"
            description="Try another search, or clear the filters to see every user."
          >
            <a
              href={resolve(
                listHref(base, page.url.searchParams, {
                  search: null,
                  status: null,
                  division: null,
                  role: null,
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
            description="A user you delete waits here, and you can restore them at any time."
          />
        {:else}
          <EmptyState
            icon={UsersIcon}
            title="No users yet"
            description="A user is a person who signs in to VMB."
          >
            {#if can("master-users.create")}
              <Button href={newHref}>
                <PlusIcon aria-hidden="true" data-icon="inline-start" />New user
              </Button>
            {/if}
          </EmptyState>
        {/if}
      {:else}
        {#if selectable}
          <SelectPageStrip
            bind:ref={stripBox}
            state={pageState}
            count={reachableIds.length}
            disabled={reachableIds.length === 0}
            onchange={() => selection.setPage(reachableIds, pageState !== "all")}
          />
        {/if}
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
              >
                {#snippet lead()}
                  {#if selectable}
                    <Checkbox
                      variant="kit"
                      bind:ref={headerBox}
                      checked={pageState === "all"}
                      indeterminate={pageState === "some"}
                      disabled={reachableIds.length === 0}
                      onCheckedChange={() => selection.setPage(reachableIds, pageState !== "all")}
                      aria-label="Select all {reachableIds.length} on this page"
                    />
                  {/if}
                {/snippet}
              </SortableHead>
              {#if columns.visible("division")}
                <Table.Head scope="col" class={columnClass("meta")}>Division</Table.Head>
              {/if}
              {#if columns.visible("roles")}
                <Table.Head scope="col" class={columnClass("text")}>Roles</Table.Head>
              {/if}
              {#if columns.visible("verified")}
                <Table.Head scope="col" class={columnClass("meta")}>Verified</Table.Head>
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
            {#each list.items as user (user.id)}
              {@const pill = pillFor(user.status)}
              <Table.Row
                class={ROW_CLASS}
                data-selected={selection.has(user.id) || undefined}
                onclick={(event) => openRow(event, user)}
                {...rowKeys.row(user)}
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
                    {#if selectable}
                      <Checkbox
                        variant="kit"
                        checked={selection.has(user.id)}
                        disabled={!user.withinReach}
                        onCheckedChange={(on) => selection.toggle(user.id, on)}
                        aria-label={user.withinReach
                          ? `Select ${user.name}`
                          : `Select ${user.name} (out of your reach)`}
                      />
                    {/if}
                    <UserAvatar
                      seed={user.id}
                      image={user.profilePhotoPath}
                      class={user.status === "inactive" ? INACTIVE_TILE_CLASS : undefined}
                    />
                    <div class="flex min-w-0 flex-col @max-lg/list:gap-0.5">
                      <div class="flex min-w-0 items-center gap-2.5">
                        <a
                          href={resolve("/(app)/master/users/[id]", { id: user.id })}
                          class={cn(
                            "truncate font-medium hover:underline",
                            user.status === "inactive" && INACTIVE_NAME_CLASS
                          )}><Marked text={user.name} term={data.query.search} /></a
                        >
                        {#if pill}
                          <!-- only the exception is marked; there is no Status column (ADR-0051 rule 7) -->
                          <StatusPill
                            status={pill}
                            class={cn(
                              "shrink-0",
                              user.status === "inactive" && INACTIVE_PILL_CLASS
                            )}
                          />
                        {/if}
                      </div>
                      <!-- the email stays under the name at every width; narrower, the second line below carries it -->
                      <p
                        class="text-muted-foreground truncate text-xs @max-lg/list:hidden"
                        title={user.email}
                      >
                        <Marked text={user.email} term={data.query.search} />
                      </p>
                      <!-- what the folded columns stand in for, under the name (ADR-0051 rule 11) -->
                      {#if columns.visible("roles") && user.roles.length > 0}
                        <p class={TEXT_LINE} title={roleNames(user)}>{roleNames(user)}</p>
                      {/if}
                      <p class={META_LINE}>
                        {#each metaParts(user) as part, index (part)}
                          {#if index > 0}{SEP}{/if}
                          {#if part === "status"}
                            <span class="text-foreground/80 font-medium"
                              >{USER_STATUS_LABELS[user.status]}</span
                            >
                          {:else if part === "email"}
                            <Marked text={user.email} term={data.query.search} />
                          {:else if part === "division"}
                            {divisionNames(user)}
                          {:else if part === "changed"}
                            {inTrash ? "Deleted" : "Updated"}{SPACE}<RecordTime
                              day
                              iso={inTrash ? user.deletedAt : user.updatedAt}
                            />
                          {:else}
                            Created{SPACE}<RecordTime day iso={user.createdAt} />
                          {/if}
                        {/each}
                      </p>
                    </div>
                  </div>
                </Table.Cell>
                {#if columns.visible("division")}
                  <Table.Cell class={cn("text-muted-foreground", columnClass("meta"))}>
                    <span
                      class={cn(TEXT_TRUNCATE, "max-w-48")}
                      title={divisionNames(user) || undefined}>{divisionNames(user) || "—"}</span
                    >
                  </Table.Cell>
                {/if}
                {#if columns.visible("roles")}
                  <Table.Cell class={cn("text-muted-foreground", columnClass("text"))}>
                    <span class={TEXT_TRUNCATE} title={roleNames(user) || undefined}
                      >{roleNames(user) || "—"}</span
                    >
                  </Table.Cell>
                {/if}
                {#if columns.visible("verified")}
                  <Table.Cell class={columnClass("meta")}>
                    {#if user.emailVerified}
                      <span class="inline-flex items-center gap-1.5">
                        <BadgeCheckIcon aria-hidden="true" class="text-primary size-4" />Verified
                      </span>
                    {:else}
                      <span class="text-muted-foreground">Not verified</span>
                    {/if}
                  </Table.Cell>
                {/if}
                {#if inTrash || columns.visible("updatedAt")}
                  <Table.Cell class={columnClass("meta")}
                    ><RecordTime iso={inTrash ? user.deletedAt : user.updatedAt} /></Table.Cell
                  >
                {/if}
                {#if columns.visible("createdAt")}
                  <Table.Cell class={columnClass("meta")}
                    ><RecordTime iso={user.createdAt} /></Table.Cell
                  >
                {/if}
                <Table.Cell
                  class={cn(
                    PINNED_BG_CLASS,
                    "pinned-end sticky right-0 z-10 text-right",
                    columnClass("utility")
                  )}
                >
                  {@const actions = rowActions(user)}
                  {#if actions.length === 1}
                    {@const only = actions[0]!}
                    {#if only.href}
                      <!-- eslint-disable svelte/no-navigation-without-resolve -- the action's href is a resolve()d path -->
                      <a
                        href={only.href}
                        data-slot="button"
                        aria-label="{only.label.replace('…', '')} {user.name}"
                        class={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          ROW_ACTION_CLASS
                        )}
                      >
                        <only.icon aria-hidden="true" data-icon="inline-start" />{only.label}
                      </a>
                      <!-- eslint-enable svelte/no-navigation-without-resolve -->
                    {:else}
                      <Button
                        variant="ghost"
                        size="sm"
                        class={ROW_ACTION_CLASS}
                        aria-label="{only.label.replace('…', '')} {user.name}"
                        onclick={only.run}
                      >
                        <only.icon aria-hidden="true" data-icon="inline-start" />{only.label}
                      </Button>
                    {/if}
                  {:else if actions.length > 1}
                    {@const menu = rowKeys.menu(user)}
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger>
                        {#snippet child({ props })}
                          <Button
                            {...props}
                            data-slot="button"
                            variant="ghost"
                            size="icon"
                            class={cn(ROW_ACTION_CLASS, ROW_MENU_TRIGGER_CLASS)}
                            aria-label="Actions for {user.name}"
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
                          {#if action.href}
                            <DropdownMenu.Item>
                              {#snippet child({ props })}
                                <!-- eslint-disable svelte/no-navigation-without-resolve -- the action's href is a resolve()d path -->
                                <a
                                  {...props}
                                  aria-keyshortcuts={rowKeys.keys ? action.shortcut : undefined}
                                  href={action.href}
                                  ><action.icon aria-hidden="true" />{action.label}{@render keyHint(
                                    action
                                  )}</a
                                >
                                <!-- eslint-enable svelte/no-navigation-without-resolve -->
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

  {#if data.users}
    <ListFooter
      {base}
      list={data.users}
      noun={inTrash ? NOUNS.trash : NOUNS.all}
      outOf={data.outOf}
      nameCount={inTrash}
    />
  {/if}
</Page>

<DeleteUserDialog
  bind:open={confirmOpen}
  {target}
  action="{actionPath}?/delete"
  ondeleted={deleted}
/>

<BulkDeleteDialog
  bind:open={bulkOpen}
  ids={bulkIds}
  noun={NOUNS.all}
  action="{actionPath}?/bulk"
  note="Their sessions end now."
  refusalCodes={["PERMISSION_ESCALATION"]}
  returnFocus={() => [headerBox, stripBox].find((box) => box && box.offsetParent !== null) ?? null}
  ondeleted={bulkDeleted}
/>
