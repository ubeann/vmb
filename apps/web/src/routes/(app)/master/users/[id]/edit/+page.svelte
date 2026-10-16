<!-- A User's edit (#304): a full page, since the form has three sections. -->
<script lang="ts">
  import { resolve } from "$app/paths";
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import UserForm from "$lib/master/UserForm.svelte";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Edit {data.user.name} — VMB</title>
</svelte:head>

<Page width="narrow" class="flex flex-col gap-4">
  <PageHeader title="Edit user" description={data.user.name} />

  <div class="bg-background flex flex-col overflow-hidden rounded-xl border pt-3">
    <UserForm
      form={data.form}
      roles={data.roles}
      reloadHref={resolve("/(app)/master/users/[id]/edit", { id: data.user.id })}
      cancelHref={resolve("/(app)/master/users/[id]", { id: data.user.id })}
    />
  </div>
</Page>
