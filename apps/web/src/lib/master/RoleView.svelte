<!--
  A Role in view mode (#303), in the layer over the list and on its full page
  alike: its fields and the permissions it grants, and for a System Role why
  there is nothing to change. The footer holds what the caller may do: Edit and
  Delete… for an ordinary Role, Edit only when it grants nothing the caller
  lacks (ADR-0045's amendment of 2026-10-17). A System Role has no footer:
  nobody can edit or delete one.

  Each action is a real link or form, so the full page works without
  JavaScript; in the layer the `on*` callbacks take their place.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import LayerCard from "$lib/components/list/layer/LayerCard.svelte";
  import LayerFooter from "$lib/components/list/layer/LayerFooter.svelte";
  import RecordTile from "$lib/components/list/RecordTile.svelte";
  import { iconLabel } from "$lib/components/icons/stored.js";
  import Notice from "$lib/components/Notice.svelte";
  import FormSection from "$lib/components/form/FormSection.svelte";
  import RecordTime from "$lib/components/RecordTime.svelte";
  import { cn } from "$lib/utils.js";
  import { SWATCHES } from "./appearance.js";
  import { listHref } from "./list.js";
  import { plainClick } from "$lib/components/list/rows.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { PERMISSION_GROUPS, type PermissionKey, type RoleDetail } from "@vmb/types";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  let {
    role,
    permissions,
    onedit,
    ondelete
  }: {
    role: RoleDetail;
    permissions: readonly string[];
    onedit?: () => void;
    ondelete?: () => void;
  } = $props();

  const can = (permission: PermissionKey) => permissions.includes(permission);

  // a System Role is read-only whoever the caller is, and so is one that grants
  // what the caller lacks; the API refuses the same
  const inReach = $derived(role.permissionKeys.every((key) => permissions.includes(key)));
  const canEdit = $derived(!role.isSystem && inReach && can("master-roles.update"));

  // what it grants, by resource in catalogue order, with each action's label
  const granted = $derived.by(() => {
    const keys = new Set(role.permissionKeys);
    return PERMISSION_GROUPS.map((group) => ({
      label: group.label,
      actions: group.permissions.filter((option) => keys.has(option.key))
    })).filter((group) => group.actions.length > 0);
  });
  const canDelete = $derived(!role.isSystem && can("master-roles.delete"));

  // a seeded colour by its name, as the form's swatches have it; any other by its hex alone
  const swatch = $derived(SWATCHES.find((option) => option.hex === role.colorHex.toUpperCase()));

  // the Users list narrowed to this Role, for a caller who can list users
  const canListUsers = $derived(can("master-users.view_any"));

  const recordHref = $derived(resolve("/(app)/master/roles/[id]", { id: role.id }));

  /** A click the layer handles itself; a modified one opens the link as usual. */
  function intercept(event: MouseEvent, run: (() => void) | undefined) {
    if (!run || !plainClick(event)) return;
    event.preventDefault();
    run();
  }
</script>

<!-- the form's own sections, so View and Edit read as one record; the status is the header's,
     on the layer and on the full page alike -->
<LayerCard class="gap-5">
  {#if role.isSystem}
    <Notice>This is a System Role. VMB depends on it, so it can't be edited or deleted.</Notice>
  {/if}

  <FormSection title="Details">
    <p class={role.description ? "text-pretty break-words" : "text-muted-foreground"}>
      <span class="sr-only">Description:</span>
      {role.description ?? "No description"}
    </p>
    <!-- a class, so the legacy paragraph margin (app.css) leaves it alone -->
    <p class="text-pretty">
      <span class="text-muted-foreground">Division</span>
      {#if role.divisionName}
        <span class="font-medium">{role.divisionName}</span>
      {:else}
        <span class="font-medium">Every division</span>
      {/if}
    </p>
    {#if canListUsers}
      <p>
        <a
          href={resolve(listHref("/master/users", new URLSearchParams(), { role: role.id }))}
          class="text-primary font-medium underline-offset-4 hover:underline"
          >Users with this Role</a
        >
      </p>
    {/if}
  </FormSection>

  <FormSection title="Permissions">
    <!-- a class, so the legacy paragraph margin (app.css) leaves it alone -->
    <p class="text-pretty">
      {#if role.permissionCount === 0}
        <span class="text-muted-foreground">No permissions: holding it grants nothing</span>
      {:else}
        <span class="font-medium tabular-nums">{role.permissionCount}</span>
        {role.permissionCount === 1 ? "permission" : "permissions"}
      {/if}
    </p>
    {#if granted.length > 0}
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {#each granted as group (group.label)}
          <dt class="text-muted-foreground">{group.label}</dt>
          <dd class="text-pretty">{group.actions.map((option) => option.label).join(", ")}</dd>
        {/each}
      </dl>
    {/if}
    {#if !role.isSystem && !inReach && can("master-roles.update")}
      <p class="text-muted-foreground text-xs text-pretty">
        It grants permissions you don't hold, so you can't edit it.
      </p>
    {/if}
  </FormSection>

  <FormSection title="Appearance">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span class="flex items-center gap-2">
        <span class="sr-only">Color:</span>
        <span
          aria-hidden="true"
          class="ring-foreground/15 size-4 shrink-0 rounded-full ring-1 ring-inset"
          style:background={role.colorHex}
        ></span>
        {#if swatch}<span>{swatch.label}</span>{/if}
        <span class={cn("font-mono", swatch && "text-muted-foreground text-xs")}
          >{role.colorHex}</span
        >
      </span>
      <span aria-hidden="true" class="text-muted-foreground">·</span>
      <span class="flex min-w-0 items-center gap-2">
        <span class="sr-only">Icon:</span>
        <RecordTile iconName={role.iconName} colorHex={role.colorHex} />
        <span class="truncate" title={role.iconName}>{iconLabel(role.iconName)}</span>
      </span>
    </div>
  </FormSection>

  <!-- when, as reference rather than reading: small, at the card's foot -->
  <FormSection>
    <p class="text-muted-foreground text-xs">
      Created <RecordTime iso={role.createdAt} /> · Updated <RecordTime iso={role.updatedAt} />
    </p>
  </FormSection>
</LayerCard>

{#if canEdit || canDelete}
  <LayerFooter class="border-t-0">
    {#if canDelete}
      <!-- without JavaScript the page asks on its own (`?delete`); with it, a dialog does -->
      <Button
        href="{recordHref}?delete"
        variant="ghost"
        class="text-destructive hover:text-destructive"
        onclick={(event: MouseEvent) => intercept(event, ondelete)}
      >
        <Trash2Icon aria-hidden="true" data-icon="inline-start" />Delete…
      </Button>
    {/if}
    {#if canEdit}
      <Button
        href={resolve("/(app)/master/roles/[id]/edit", { id: role.id })}
        class="ml-auto min-w-0 flex-1 min-[480px]:flex-none"
        onclick={(event: MouseEvent) => intercept(event, onedit)}
      >
        <PencilIcon aria-hidden="true" data-icon="inline-start" />Edit
      </Button>
    {/if}
  </LayerFooter>
{/if}
