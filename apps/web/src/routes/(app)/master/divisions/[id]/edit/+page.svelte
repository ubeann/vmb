<!-- A Division's edit as a full page (#302): the layer's form, for a link opened directly or no JavaScript. -->
<script lang="ts">
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import DivisionForm from "$lib/master/DivisionForm.svelte";
  import { resolve } from "$app/paths";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Edit {data.division.name} — VMB</title>
</svelte:head>

<Page width="narrow" class="flex flex-col gap-4">
  <PageHeader title="Edit division" description={data.division.name} />

  <div class="bg-background flex flex-col overflow-hidden rounded-xl border pt-3">
    <DivisionForm
      form={data.form}
      reloadHref={resolve("/(app)/master/divisions/[id]/edit", { id: data.division.id })}
      cancelHref={resolve("/(app)/master/divisions/[id]", { id: data.division.id })}
    />
  </div>
</Page>
