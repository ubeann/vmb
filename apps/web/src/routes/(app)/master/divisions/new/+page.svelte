<!-- A new Division as a full page (#302): the layer's form, for a link opened directly or no JavaScript. -->
<script lang="ts">
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import DivisionForm from "$lib/master/DivisionForm.svelte";
  import { resolve } from "$app/paths";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>New division — VMB</title>
</svelte:head>

<Page width="narrow" class="flex flex-col gap-4">
  <PageHeader title="New division" />

  <div class="bg-background flex flex-col overflow-hidden rounded-xl border pt-3">
    <DivisionForm
      form={data.form}
      submitLabel="Create division"
      submitIcon={PlusIcon}
      pendingLabel="Creating…"
      cancelHref={resolve("/master/divisions")}
    />
  </div>
</Page>
