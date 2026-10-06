<script lang="ts">
  import { resolve } from "$app/paths";
  import type { PageData } from "./$types.js";

  let { data, form }: { data: PageData; form: { error?: string } | null } = $props();
</script>

<svelte:head>
  <title>{data.role.name} — VMB</title>
</svelte:head>

<h2>
  {data.role.name}
  {#if data.role.isSystem}<span class="badge">system</span>{/if}
</h2>

{#if form?.error}
  <p role="alert" class="error">{form.error}</p>
{/if}

<dl>
  <dt>Description</dt>
  <dd>{data.role.description ?? "No description"}</dd>

  <dt>Color</dt>
  <dd>
    <span class="swatch" style="background: {data.role.colorHex}"></span>
    {data.role.colorHex}
  </dd>

  <dt>Icon</dt>
  <dd>{data.role.iconName}</dd>

  <dt>Status</dt>
  <dd>{data.role.isActive ? "Active" : "Inactive"}</dd>

  <dt>Created</dt>
  <dd>{data.role.createdAt ?? "—"}</dd>

  <dt>Updated</dt>
  <dd>{data.role.updatedAt ?? "—"}</dd>
</dl>

{#if data.role.isSystem}
  <p class="muted">System roles cannot be modified or deleted.</p>
{:else}
  <p><a href={resolve("/(app)/master/roles/[id]/edit", { id: data.role.id })}>Edit</a></p>

  <form method="POST" action="?/delete">
    <input type="hidden" name="id" value={data.role.id} />
    <button type="submit">Delete</button>
  </form>
{/if}

<p><a href={resolve("/master/roles")}>Back to roles</a></p>
