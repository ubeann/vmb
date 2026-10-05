<script lang="ts">
  import UserForm from "$lib/master/UserForm.svelte";
  import { resolve } from "$app/paths";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Edit user — VMB</title>
</svelte:head>

<h2>Edit user</h2>

<UserForm form={data.form} divisions={data.divisions} />

<p><a href={resolve("/(app)/master/users/[id]", { id: data.user.id })}>Back to user</a></p>
