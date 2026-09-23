<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  let { children } = $props();
</script>

<svelte:head>
  <title>Master — VMB</title>
</svelte:head>

<nav>
  <a
    href={resolve("/master/divisions")}
    aria-current={page.url.pathname.startsWith("/master/divisions") ? "page" : undefined}
    >Divisions</a
  >
  <a
    href={resolve("/master/roles")}
    aria-current={page.url.pathname.startsWith("/master/roles") ? "page" : undefined}>Roles</a
  >
  <a
    href={resolve("/master/users")}
    aria-current={page.url.pathname.startsWith("/master/users") ? "page" : undefined}>Users</a
  >
</nav>

{@render children()}
