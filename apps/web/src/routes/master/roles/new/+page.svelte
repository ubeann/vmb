<script lang="ts">
  import RoleForm from "$lib/master/RoleForm.svelte";
  import { resolve } from "$app/paths";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>New role — VMB</title>
</svelte:head>

<h2>New role</h2>

<RoleForm form={data.form} submitLabel="Create role" />

<p><a href={resolve("/master/roles")}>Back to roles</a></p>
