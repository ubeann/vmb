<script lang="ts">
  import { pageHref } from "$lib/master/list.js";
  import { resolve } from "$app/paths";
  import { USER_STATUS_LABELS } from "@vmb/types";
  import type { PageData } from "./$types.js";

  let { data, form }: { data: PageData; form: { error?: string } | null } = $props();

  const base = "/master/users";

  let totalPages = $derived(
    data.users ? Math.max(1, Math.ceil(data.users.total / data.users.perPage)) : 1
  );

  let divisionNames = $derived(
    new Map(data.divisions.map((division) => [division.id, division.name]))
  );

  function divisionName(divisionId: string | null): string {
    if (!divisionId) return "No division";
    return divisionNames.get(divisionId) ?? "Unknown division";
  }
</script>

<svelte:head>
  <title>Users — VMB</title>
</svelte:head>

<h2>Users</h2>

{#if form?.error}
  <p role="alert" class="error">{form.error}</p>
{/if}

<form class="filters" method="GET">
  <label>
    <span>Search</span>
    <input type="search" name="search" value={data.query.search ?? ""} />
  </label>

  <label>
    <span>Division</span>
    <select name="divisionId">
      <option value="" selected={!data.query.divisionId}>All divisions</option>
      {#each data.divisions as division (division.id)}
        <option value={division.id} selected={data.query.divisionId === division.id}>
          {division.name}
        </option>
      {/each}
    </select>
  </label>

  <label>
    <span>Status</span>
    <select name="status">
      <option value="all" selected={data.query.status === "all"}>All</option>
      <option value="active" selected={data.query.status === "active"}>Active</option>
      <option value="inactive" selected={data.query.status === "inactive"}>Inactive</option>
      <option value="suspended" selected={data.query.status === "suspended"}>Suspended</option>
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

<p><a href={resolve("/master/users/new")}>New user</a></p>

{#if !data.users}
  <p role="alert" class="error">Could not load users. Please try again.</p>
{:else if data.users.items.length === 0}
  <p>No users found.</p>
{:else}
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Division</th>
        <th>Email</th>
        <th>Phone</th>
        <th>Status</th>
        <th>Verified</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.users.items as user (user.id)}
        <tr>
          <td>
            <a href={resolve("/(app)/master/users/[id]", { id: user.id })}>{user.name}</a>
            {#if user.deletedAt}<span class="badge">trashed</span>{/if}
          </td>
          <td>{divisionName(user.divisionId)}</td>
          <td>{user.email}</td>
          <td>{user.phone ?? "No phone number"}</td>
          <td>{USER_STATUS_LABELS[user.status]}</td>
          <td>{user.emailVerifiedAt ? "Verified" : "Unverified"}</td>
          <td>
            <a href={resolve("/(app)/master/users/[id]/edit", { id: user.id })}>Edit</a>
            {#if user.deletedAt}
              <form class="actions" method="POST" action="?/restore">
                <input type="hidden" name="id" value={user.id} />
                <button type="submit">Restore</button>
              </form>
            {:else}
              <form class="actions" method="POST" action="?/delete">
                <input type="hidden" name="id" value={user.id} />
                <button type="submit">Delete</button>
              </form>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <div class="pagination">
    {#if data.users.page > 1}
      <a href={resolve(pageHref(base, data.query, data.users.page - 1))}>Previous</a>
    {/if}
    <span>Page {data.users.page} of {totalPages} ({data.users.total} total)</span>
    {#if data.users.page < totalPages}
      <a href={resolve(pageHref(base, data.query, data.users.page + 1))}>Next</a>
    {/if}
  </div>
{/if}
