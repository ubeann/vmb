<script lang="ts">
  import { USER_STATUS_LABELS } from "@vmb/types";
  import { resolve } from "$app/paths";
  import type { PageData } from "./$types.js";

  let { data, form }: { data: PageData; form: { error?: string } | null } = $props();

  let divisionName = $derived(
    data.divisions.find((division) => division.id === data.user.divisionId)?.name ??
      "Unknown division"
  );
</script>

<svelte:head>
  <title>{data.user.name} — VMB</title>
</svelte:head>

<h2>
  {data.user.name}
  {#if data.user.deletedAt}<span class="badge">trashed</span>{/if}
</h2>

{#if form?.error}
  <p role="alert" class="error">{form.error}</p>
{/if}

<dl>
  <dt>Division</dt>
  <dd>{divisionName}</dd>

  <dt>Email</dt>
  <dd>{data.user.email} ({data.user.emailVerified ? "verified" : "unverified"})</dd>

  <dt>Phone</dt>
  <dd>{data.user.phone ?? "No phone number"}</dd>

  <dt>Status</dt>
  <dd>{USER_STATUS_LABELS[data.user.status]}</dd>

  <dt>Profile photo</dt>
  <dd>
    {#if data.user.profilePhotoPath}
      <a href={data.user.profilePhotoPath} rel="external">{data.user.profilePhotoPath}</a>
    {:else}
      No photo
    {/if}
  </dd>

  <dt>Created</dt>
  <dd>{data.user.createdAt ?? "—"}</dd>

  <dt>Updated</dt>
  <dd>{data.user.updatedAt ?? "—"}</dd>
</dl>

<p><a href={resolve("/(app)/master/users/[id]/edit", { id: data.user.id })}>Edit</a></p>

{#if data.user.deletedAt}
  <form method="POST" action="?/restore">
    <input type="hidden" name="id" value={data.user.id} />
    <button type="submit">Restore</button>
  </form>
{:else}
  <form method="POST" action="?/delete">
    <input type="hidden" name="id" value={data.user.id} />
    <button type="submit">Delete</button>
  </form>
{/if}

<p><a href={resolve("/master/users")}>Back to users</a></p>
