<script lang="ts">
  import { pageHref } from "$lib/master/list.js";
  import { resolve } from "$app/paths";
  import type { PageData } from "./$types.js";

  let { data, form }: { data: PageData; form: { error?: string } | null } = $props();

  const base = "/master/roles";

  let totalPages = $derived(
    data.roles ? Math.max(1, Math.ceil(data.roles.total / data.roles.perPage)) : 1
  );
</script>

<svelte:head>
  <title>Roles — VMB</title>
</svelte:head>

<h2>Roles</h2>

{#if form?.error}
  <p role="alert" class="error">{form.error}</p>
{/if}

<form class="filters" method="GET">
  <label>
    <span>Search</span>
    <input type="search" name="search" value={data.query.search ?? ""} />
  </label>

  <label>
    <span>Status</span>
    <select name="active">
      <option value="all" selected={data.query.active === "all"}>All</option>
      <option value="active" selected={data.query.active === "active"}>Active</option>
      <option value="inactive" selected={data.query.active === "inactive"}>Inactive</option>
    </select>
  </label>

  <button type="submit">Filter</button>
  <a href={resolve(base)}>Reset</a>
</form>

<p><a href={resolve("/master/roles/new")}>New role</a></p>

{#if !data.roles}
  <p role="alert" class="error">Could not load roles. Please try again.</p>
{:else if data.roles.items.length === 0}
  <p>No roles found.</p>
{:else}
  <table>
    <thead>
      <tr>
        <th>Role</th>
        <th>Status</th>
        <th>Color</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.roles.items as role (role.id)}
        <tr>
          <td>
            <a href={resolve("/(app)/master/roles/[id]", { id: role.id })}>{role.name}</a>
            {#if role.isSystem}<span class="badge">system</span>{/if}
          </td>
          <td>{role.isActive ? "Active" : "Inactive"}</td>
          <td>
            <span class="swatch" style="background: {role.colorHex}"></span>
            {role.colorHex}
          </td>
          <td>
            {#if role.isSystem}
              <span class="muted">System roles cannot be modified</span>
            {:else}
              <a href={resolve("/(app)/master/roles/[id]/edit", { id: role.id })}>Edit</a>
              <form class="actions" method="POST" action="?/delete">
                <input type="hidden" name="id" value={role.id} />
                <button type="submit">Delete</button>
              </form>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <div class="pagination">
    {#if data.roles.page > 1}
      <a href={resolve(pageHref(base, data.query, data.roles.page - 1))}>Previous</a>
    {/if}
    <span>Page {data.roles.page} of {totalPages} ({data.roles.total} total)</span>
    {#if data.roles.page < totalPages}
      <a href={resolve(pageHref(base, data.query, data.roles.page + 1))}>Next</a>
    {/if}
  </div>
{/if}
