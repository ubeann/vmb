<!-- A Role's edit as a full page (#303): the layer's form, for a link opened directly or no JavaScript. -->
<script lang="ts">
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RoleForm from "$lib/master/RoleForm.svelte";
  import { resolve } from "$app/paths";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Edit {data.role.name} — VMB</title>
</svelte:head>

<Page width="narrow" class="flex flex-col gap-4">
  <PageHeader title="Edit role" description={data.role.name} />

  <div class="bg-background flex flex-col overflow-hidden rounded-xl border pt-3">
    <RoleForm
      form={data.form}
      divisions={data.divisions}
      holders={data.role.userCount}
      held={data.permissions}
      reloadHref={resolve("/(app)/master/roles/[id]/edit", { id: data.role.id })}
      cancelHref={resolve("/(app)/master/roles/[id]", { id: data.role.id })}
    />
  </div>
</Page>
