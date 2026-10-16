<!--
  A User's full page (#304): the form's own three sections, as facts, so View
  and Edit read as one record. The footer holds what the caller may do: Edit
  and Delete… for a live user, Restore for one in the Trash, which is read-only
  until it comes back (ADR-0055). Each action is a real link or form, so the
  page works without JavaScript; Delete… asks in a dialog when it has one, and
  on the page itself (`?delete`) when it has not.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import FormSection from "$lib/components/form/FormSection.svelte";
  import LayerCard from "$lib/components/list/layer/LayerCard.svelte";
  import LayerFooter from "$lib/components/list/layer/LayerFooter.svelte";
  import { plainClick } from "$lib/components/list/rows.js";
  import Notice from "$lib/components/Notice.svelte";
  import RecordTime from "$lib/components/RecordTime.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import type { PermissionKey, User } from "@vmb/types";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  let {
    user,
    permissions,
    ondelete
  }: {
    user: User;
    permissions: readonly string[];
    ondelete?: () => void;
  } = $props();

  const can = (permission: PermissionKey) => permissions.includes(permission);
  const trashed = $derived(user.deletedAt !== null);

  const recordHref = $derived(resolve("/(app)/master/users/[id]", { id: user.id }));

  /** A click the page handles itself; a modified one opens the link as usual. */
  function intercept(event: MouseEvent, run: (() => void) | undefined) {
    if (!run || !plainClick(event)) return;
    event.preventDefault();
    run();
  }

  // facts are a term and its value; classes keep the legacy `dl` rules off them
  const TERM = "text-muted-foreground text-sm";
  const VALUE = "min-w-0 text-pretty break-words";
</script>

<LayerCard class="gap-5">
  {#if trashed}
    <Notice>
      This user is in the Trash, so nothing can be changed until they are restored. Their sessions
      ended when they were deleted.
    </Notice>
  {/if}

  <FormSection title="Personal details">
    <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
      <dt class={TERM}>Name</dt>
      <dd class="{VALUE} font-medium">{user.name}</dd>
      <dt class={TERM}>Email</dt>
      <dd class={VALUE}>{user.email}</dd>
      <dt class={TERM}>Phone number</dt>
      <dd class={user.phone ? VALUE : `${VALUE} text-muted-foreground`}>
        {user.phone ?? "No phone number"}
      </dd>
      <dt class={TERM}>Photo link</dt>
      <dd class={user.profilePhotoPath ? VALUE : `${VALUE} text-muted-foreground`}>
        {#if user.profilePhotoPath}
          <a
            href={user.profilePhotoPath}
            rel="external noreferrer"
            class="underline underline-offset-2">{user.profilePhotoPath}</a
          >
        {:else}
          No photo, so a picture drawn from their id
        {/if}
      </dd>
    </dl>
  </FormSection>

  <FormSection title="Authorization">
    <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
      <dt class={TERM}>Roles</dt>
      <dd class={VALUE}>
        {#if user.roles.length > 0}
          <ul class="flex flex-wrap gap-1.5">
            {#each user.roles as role (role.id)}
              <li class="bg-muted inline-flex h-6 items-center rounded-md px-2 text-sm font-medium">
                {role.name}
              </li>
            {/each}
          </ul>
        {:else}
          <span class="text-muted-foreground">No roles</span>
        {/if}
      </dd>
      <dt class={TERM}>Divisions</dt>
      <dd class={user.divisions.length > 0 ? VALUE : `${VALUE} text-muted-foreground`}>
        {user.divisions.map((division) => division.name).join(", ") || "None, through their roles"}
      </dd>
    </dl>
  </FormSection>

  <FormSection title="Security">
    <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
      <dt class={TERM}>Email</dt>
      <dd class={VALUE}>{user.emailVerified ? "Verified" : "Not verified yet"}</dd>
    </dl>
  </FormSection>

  <!-- when, as reference rather than reading: small, at the card's foot -->
  <FormSection>
    <p class="text-muted-foreground text-xs">
      Created <RecordTime iso={user.createdAt} /> · {trashed ? "Deleted" : "Updated"}
      <RecordTime iso={trashed ? user.deletedAt : user.updatedAt} />
    </p>
  </FormSection>
</LayerCard>

{#if trashed}
  {#if can("master-users.restore")}
    <LayerFooter class="border-t-0">
      <form method="POST" action="?/restore" class="ml-auto min-w-0 flex-1 min-[480px]:flex-none">
        <input type="hidden" name="id" value={user.id} />
        <Button type="submit" class="w-full">
          <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />Restore
        </Button>
      </form>
    </LayerFooter>
  {/if}
{:else if can("master-users.update") || can("master-users.delete")}
  <LayerFooter class="border-t-0">
    {#if can("master-users.delete")}
      <Button
        href="{recordHref}?delete"
        variant="ghost"
        class="text-destructive hover:text-destructive"
        onclick={(event: MouseEvent) => intercept(event, ondelete)}
      >
        <Trash2Icon aria-hidden="true" data-icon="inline-start" />Delete…
      </Button>
    {/if}
    {#if can("master-users.update")}
      <Button
        href={resolve("/(app)/master/users/[id]/edit", { id: user.id })}
        class="ml-auto min-w-0 flex-1 min-[480px]:flex-none"
      >
        <PencilIcon aria-hidden="true" data-icon="inline-start" />Edit
      </Button>
    {/if}
  </LayerFooter>
{/if}
