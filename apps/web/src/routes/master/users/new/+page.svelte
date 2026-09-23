<script lang="ts">
  import UserForm from "$lib/master/UserForm.svelte";
  import { resolve } from "$app/paths";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>New user — VMB</title>
</svelte:head>

<h2>New user</h2>

<UserForm form={data.form} divisions={data.divisions} passwordRequired submitLabel="Create user" />

<p><a href={resolve("/master/users")}>Back to users</a></p>
