<!-- A new User (#304): a full page, since the form has three sections and a password. -->
<script lang="ts">
  import { resolve } from "$app/paths";
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import UserForm from "$lib/master/UserForm.svelte";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>New user — VMB</title>
</svelte:head>

<Page width="narrow" class="flex flex-col gap-4">
  <PageHeader
    title="New user"
    description="They sign in with this email and the password you set here."
  />

  <div class="bg-background flex flex-col overflow-hidden rounded-xl border pt-3">
    <UserForm
      form={data.form}
      roles={data.roles}
      passwordRequired
      cancelHref={resolve("master/users")}
    />
  </div>
</Page>
