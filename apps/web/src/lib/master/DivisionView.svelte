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
  import LayerCard from "$lib/components/list/layer/LayerCard.svelte";
  import LayerFooter from "$lib/components/list/layer/LayerFooter.svelte";
  import RecordTile from "$lib/components/list/RecordTile.svelte";
  import { iconLabel } from "$lib/components/icons/stored.js";
  import Notice from "$lib/components/Notice.svelte";
  import FormSection from "$lib/components/form/FormSection.svelte";
  import RecordTime from "$lib/components/RecordTime.svelte";
  import { cn } from "$lib/utils.js";
  import { SWATCHES } from "./appearance.js";
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

  // a seeded colour by its name, as the form's swatches have it; any other by its hex alone
  const swatch = $derived(
    SWATCHES.find((option) => option.hex === division.colorHex.toUpperCase())
  );

  const recordHref = $derived(resolve("/(app)/master/divisions/[id]", { id: division.id }));

  /** A click the layer handles itself; a modified one opens the link as usual. */
  function intercept(event: MouseEvent, run: (() => void) | undefined) {
    if (!run || !plainClick(event)) return;
    event.preventDefault();
    run();
  }
</script>

<!-- the form's own sections, so View and Edit read as one record; the code and the status are
     the header's, on the layer and on the full page alike -->
<LayerCard class="gap-5">
  {#if trashed}
    <Notice>In the Trash. Restore it to change it.</Notice>
  {/if}

  <FormSection title="Details">
    <p class={division.description ? "text-pretty break-words" : "text-muted-foreground"}>
      <span class="sr-only">Description:</span>
      {division.description ?? "No description"}
    </p>
    <!-- what deleting it touches, a link to those users; a class, so the legacy paragraph margin
         (app.css) leaves it alone -->
    <p class="text-pretty">
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()d, with the list's filter after it -->
      <a
        href="{resolve('master/users')}?divisionId={division.id}"
        class="text-primary font-medium underline-offset-4 hover:underline">{users}</a
      >
      <span class="text-muted-foreground">in roles of this division</span>
    </p>
  </FormSection>

  <FormSection title="Appearance">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span class="flex items-center gap-2">
        <span class="sr-only">Color:</span>
        <span
          aria-hidden="true"
          class="ring-foreground/15 size-4 shrink-0 rounded-full ring-1 ring-inset"
          style:background={division.colorHex}
        ></span>
        {#if swatch}<span>{swatch.label}</span>{/if}
        <span class={cn("font-mono", swatch && "text-muted-foreground text-xs")}
          >{division.colorHex}</span
        >
      </span>
      <span aria-hidden="true" class="text-muted-foreground">·</span>
      <span class="flex min-w-0 items-center gap-2">
        <span class="sr-only">Icon:</span>
        <RecordTile iconName={division.iconName} colorHex={division.colorHex} />
        <span class="truncate" title={division.iconName}>{iconLabel(division.iconName)}</span>
      </span>
    </div>
  </FormSection>

  <!-- when, as reference rather than reading: small, at the card's foot -->
  <FormSection>
    <p class="text-muted-foreground text-xs">
      Created <RecordTime iso={division.createdAt} /> · Updated <RecordTime
        iso={division.updatedAt}
      />
    </p>
  </FormSection>
</LayerCard>

{#if canRestore}
  <LayerFooter class="border-t-0">
    <form method="POST" action="{recordHref}?/restore" class="flex flex-1 justify-end">
      <input type="hidden" name="id" value={division.id} />
      <Button
        type="submit"
        class="ml-auto min-w-0 flex-1 min-[480px]:flex-none"
        onclick={(event) => intercept(event, onrestore)}
      >
        <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />Restore
      </Button>
    </form>
  </LayerFooter>
{:else if canEdit || canDelete}
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
        href={resolve("/(app)/master/divisions/[id]/edit", { id: division.id })}
        class="ml-auto min-w-0 flex-1 min-[480px]:flex-none"
        onclick={(event: MouseEvent) => intercept(event, onedit)}
      >
        <PencilIcon aria-hidden="true" data-icon="inline-start" />Edit
      </Button>
    {/if}
  </LayerFooter>
{/if}
