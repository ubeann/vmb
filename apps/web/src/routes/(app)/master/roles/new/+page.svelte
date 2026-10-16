<!-- A new Role as a full page (#303): the layer's form, for a link opened directly or no JavaScript. -->
<script lang="ts">
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RoleForm from "$lib/master/RoleForm.svelte";
  import { resolve } from "$app/paths";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>New role — VMB</title>
</svelte:head>

<Page width="narrow" class="flex flex-col gap-4">
  <PageHeader title="New role" />

  <div class="bg-background flex flex-col overflow-hidden rounded-xl border pt-3">
    <RoleForm
      form={data.form}
      submitLabel="Create role"
      submitIcon={PlusIcon}
      pendingLabel="Creating…"
      cancelHref={resolve("/master/roles")}
    />
  </div>
</Page>
