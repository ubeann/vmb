<script lang="ts">
  import { pageHref } from "$lib/master/list.js";
  import { resolve } from "$app/paths";
  import type { PageData } from "./$types.js";

  let { data, form }: { data: PageData; form: { error?: string } | null } = $props();

  const base = "/master/divisions";

  let totalPages = $derived(
    data.divisions ? Math.max(1, Math.ceil(data.divisions.total / data.divisions.perPage)) : 1
  );
</script>

<svelte:head>
  <title>Divisions — VMB</title>
</svelte:head>

<h2>Divisions</h2>

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
    <select name="status">
      <option value="all" selected={data.query.status === "all"}>All</option>
      <option value="active" selected={data.query.status === "active"}>Active</option>
      <option value="inactive" selected={data.query.status === "inactive"}>Inactive</option>
    </select>
  </label>

  <label>
    <span>Trashed</span>
    <select name="trashed">
      <option value="exclude" selected={data.query.trashed === "exclude"}>Without trashed</option>
      <option value="only" selected={data.query.trashed === "only"}>Only trashed</option>
      <option value="include" selected={data.query.trashed === "include"}>With trashed</option>
      <option value="include" selected={data.query.trashed === "include"}>With trashed</option>
    </select>
  </label>

  <button type="submit">Filter</button>
  <a href={resolve(base)}>Reset</a>
</form>

<p><a href={resolve("/master/divisions/new")}>New division</a></p>

{#if !data.divisions}
  <p role="alert" class="error">Could not load divisions. Please try again.</p>
{:else if data.divisions.items.length === 0}
  <p>No divisions found.</p>
{:else}
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Code</th>
        <th>Description</th>
        <th>Color</th>
        <th>Icon</th>
        <th>Active</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.divisions.items as division (division.id)}
        <tr>
          <td>
            <a href={resolve("/(app)/master/divisions/[id]", { id: division.id })}
              >{division.name}</a
            >
            {#if division.deletedAt}<span class="badge">trashed</span>{/if}
          </td>
          <td>{division.code}</td>
          <td class="muted">
            {division.description
              ? division.description.slice(0, 40) + (division.description.length > 40 ? "…" : "")
              : "No description"}
          </td>
          <td>
            <span class="swatch" style="background: {division.colorHex}"></span>
            {division.colorHex}
          </td>
          <td class="muted">{division.iconName}</td>
          <td>{division.isActive ? "Active" : "Inactive"}</td>
          <td>
            <a href={resolve("/(app)/master/divisions/[id]/edit", { id: division.id })}>Edit</a>
            {#if division.deletedAt}
              <form class="actions" method="POST" action="?/restore">
                <input type="hidden" name="id" value={division.id} />
                <button type="submit">Restore</button>
              </form>
            {:else}
              <form class="actions" method="POST" action="?/delete">
                <input type="hidden" name="id" value={division.id} />
                <button type="submit">Delete</button>
              </form>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <div class="pagination">
    {#if data.divisions.page > 1}
      <a href={resolve(pageHref(base, data.query, data.divisions.page - 1))}>Previous</a>
    {/if}
    <span>Page {data.divisions.page} of {totalPages} ({data.divisions.total} total)</span>
    {#if data.divisions.page < totalPages}
      <a href={resolve(pageHref(base, data.query, data.divisions.page + 1))}>Next</a>
    {/if}
  </div>
{/if}
