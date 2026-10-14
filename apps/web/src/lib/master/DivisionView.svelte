<!--
  A Division in view mode (#302), in the layer over the list and on its full
  page alike: its fields, and how many Users are in it so the cost of
  deleting it is plain. The footer holds what the caller may do: Edit and
  Delete… for a live Division, Restore for one in the Trash (ADR-0055: it is
  read-only until restored).

  Each action is a real link or form, so the full page works without
  JavaScript; in the layer the `on*` callbacks take their place.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import LayerBody from "$lib/components/list/layer/LayerBody.svelte";
  import LayerFooter from "$lib/components/list/layer/LayerFooter.svelte";
  import RecordTile from "$lib/components/list/RecordTile.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import RecordTime from "$lib/components/RecordTime.svelte";
  import StatusPill from "$lib/components/StatusPill.svelte";
  import { plainClick } from "$lib/components/list/rows.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import type { DivisionDetail, PermissionKey } from "@vmb/types";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  let {
    division,
    permissions,
    onedit,
    ondelete,
    onrestore
  }: {
    division: DivisionDetail;
    permissions: readonly string[];
    onedit?: () => void;
    ondelete?: () => void;
    onrestore?: () => void;
  } = $props();

  const can = (permission: PermissionKey) => permissions.includes(permission);

  const trashed = $derived(Boolean(division.deletedAt));
  const canEdit = $derived(!trashed && can("master-divisions.update"));
  const canDelete = $derived(!trashed && can("master-divisions.delete"));
  const canRestore = $derived(trashed && can("master-divisions.restore"));
  const users = $derived(
    division.userCount === 0
      ? "No users"
      : `${division.userCount} ${division.userCount === 1 ? "user" : "users"}`
  );

  const recordHref = $derived(resolve("/(app)/master/divisions/[id]", { id: division.id }));

  /** A click the layer handles itself; a modified one opens the link as usual. */
  function intercept(event: MouseEvent, run: (() => void) | undefined) {
    if (!run || !plainClick(event)) return;
    event.preventDefault();
    run();
  }
</script>

<LayerBody class="flex flex-col gap-4 p-4">
  {#if trashed}
    <Notice>In the Trash. Restore it to change it.</Notice>
  {/if}

  <dl
    class="[&_dt]:text-muted-foreground grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-6 gap-y-3 [&_dd]:m-0"
  >
    <dt>Code</dt>
    <dd class="font-mono">{division.code}</dd>

    <dt>Status</dt>
    <dd><StatusPill status={division.isActive ? "Active" : "Inactive"} /></dd>

    <dt>Users</dt>
    <dd>
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()d, with the list's filter after it -->
      <a
        href="{resolve('/master/users')}?divisionId={division.id}"
        class="text-primary font-medium underline-offset-4 hover:underline">{users}</a
      >
      <span class="text-muted-foreground">in roles of this division</span>
    </dd>

    <dt>Description</dt>
    <dd class={division.description ? "break-words" : "text-muted-foreground"}>
      {division.description ?? "No description"}
    </dd>

    <dt>Color</dt>
    <dd class="flex items-center gap-2">
      <span
        aria-hidden="true"
        class="ring-foreground/15 size-4 shrink-0 rounded-sm ring-1 ring-inset"
        style:background={division.colorHex}
      ></span>
      <span class="font-mono">{division.colorHex}</span>
    </dd>

    <dt>Icon</dt>
    <dd class="flex min-w-0 items-center gap-2">
      <RecordTile iconName={division.iconName} colorHex={division.colorHex} />
      <span class="truncate font-mono">{division.iconName}</span>
    </dd>

    <dt>Created</dt>
    <dd><RecordTime iso={division.createdAt} /></dd>

    <dt>Updated</dt>
    <dd><RecordTime iso={division.updatedAt} /></dd>
  </dl>
</LayerBody>

{#if canRestore}
  <LayerFooter>
    <form method="POST" action="{recordHref}?/restore" class="flex flex-1">
      <input type="hidden" name="id" value={division.id} />
      <Button
        type="submit"
        class="min-w-0 flex-1 in-data-[layer-frame=modal]:h-11"
        onclick={(event) => intercept(event, onrestore)}
      >
        <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />Restore
      </Button>
    </form>
  </LayerFooter>
{:else if canEdit || canDelete}
  <LayerFooter>
    {#if canDelete}
      <!-- without JavaScript the page asks on its own (`?delete`); with it, a dialog does -->
      <Button
        href="{recordHref}?delete"
        variant="ghost"
        class="text-destructive hover:text-destructive in-data-[layer-frame=modal]:h-11"
        onclick={(event: MouseEvent) => intercept(event, ondelete)}
      >
        <Trash2Icon aria-hidden="true" data-icon="inline-start" />Delete…
      </Button>
    {/if}
    {#if canEdit}
      <Button
        href={resolve("/(app)/master/divisions/[id]/edit", { id: division.id })}
        class="ml-auto min-w-0 flex-1 in-data-[layer-frame=modal]:h-11"
        onclick={(event: MouseEvent) => intercept(event, onedit)}
      >
        <PencilIcon aria-hidden="true" data-icon="inline-start" />Edit
      </Button>
    {/if}
  </LayerFooter>
{/if}
