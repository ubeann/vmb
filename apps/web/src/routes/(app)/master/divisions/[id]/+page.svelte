<script lang="ts">
  import Page from "$lib/components/Page.svelte";
  import type { PageData } from "./$types.js";
  import { resolve } from "$app/paths";

  let { data, form }: { data: PageData; form: { error?: string } | null } = $props();
</script>

<svelte:head>
  <title>{data.division.name} — VMB</title>
</svelte:head>

<Page width="narrow">
  <h2>
    {data.division.name}
    {#if data.division.deletedAt}<span class="badge">trashed</span>{/if}
  </h2>

  {#if form?.error}
    <p role="alert" class="error">{form.error}</p>
  {/if}

  <dl>
    <dt>Code</dt>
    <dd>{data.division.code}</dd>

    <dt>Description</dt>
    <dd>{data.division.description ?? "No description"}</dd>

    <dt>Color</dt>
    <dd>
      <span class="swatch" style="background: {data.division.colorHex}"></span>
      {data.division.colorHex}
    </dd>

    <dt>Icon</dt>
    <dd>{data.division.iconName}</dd>

    <dt>Status</dt>
    <dd>{data.division.isActive ? "Active" : "Inactive"}</dd>

    <dt>Created</dt>
    <dd>{data.division.createdAt ?? "—"}</dd>

    <dt>Updated</dt>
    <dd>{data.division.updatedAt ?? "—"}</dd>
  </dl>

  <p>
    <a href={resolve("/(app)/master/divisions/[id]/edit", { id: data.division.id })}>Edit</a>
  </p>

  {#if data.division.deletedAt}
    <form method="POST" action="?/restore">
      <input type="hidden" name="id" value={data.division.id} />
      <button type="submit">Restore</button>
    </form>
  {:else}
    <form method="POST" action="?/delete">
      <input type="hidden" name="id" value={data.division.id} />
      <button type="submit">Delete</button>
    </form>
  {/if}

  <p><a href={resolve("/master/divisions")}>Back to divisions</a></p>
</Page>
