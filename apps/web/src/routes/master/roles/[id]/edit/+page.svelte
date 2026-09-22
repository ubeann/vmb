<script lang="ts">
  import RoleForm from "$lib/master/RoleForm.svelte";
  import { resolve } from "$app/paths";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Edit role — VMB</title>
</svelte:head>

<h2>Edit role</h2>

<RoleForm form={data.form} />

<p><a href={resolve("/master/roles/[id]", { id: data.role.id })}>Back to role</a></p>
