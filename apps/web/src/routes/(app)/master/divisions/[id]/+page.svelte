<!--
  A Division's full page (#302): what the layer over the list shows, for a
  link opened directly, a reload or a browser without JavaScript. Delete asks
  first in a dialog, or without JavaScript on the page itself (`?delete`).
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import Notice from "$lib/components/Notice.svelte";
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import DeleteDivisionDialog from "$lib/master/DeleteDivisionDialog.svelte";
  import DivisionView from "$lib/master/DivisionView.svelte";
  import { toast } from "svelte-sonner";
  import type { PageData } from "./$types.js";

  let { data, form }: { data: PageData; form: { error?: string; code?: string } | null } = $props();

  let confirmOpen = $state(false);

  const recordHref = $derived(resolve("/(app)/master/divisions/[id]", { id: data.division.id }));
  const askingDelete = $derived(
    data.confirmDelete &&
      !data.division.deletedAt &&
      data.permissions.includes("master-divisions.delete")
  );
</script>

<svelte:head>
  <title>{data.division.name} — VMB</title>
</svelte:head>

<Page width="narrow" class="flex flex-col gap-4">
  <PageHeader title={data.division.name} />

  {#if form?.error}
    <Notice variant="destructive">
      {form.error}
      {#if form.code === "DIVISION_IN_USE"}
        <a href={resolve("/master/roles")} class="font-medium underline underline-offset-2"
          >Go to Roles</a
        >
      {/if}
    </Notice>
  {/if}

  {#if askingDelete}
    <section
      aria-labelledby="delete-title"
      class="border-destructive/30 bg-destructive/5 flex flex-col gap-3 rounded-xl border p-4"
    >
      <h2 id="delete-title" class="font-semibold">Delete {data.division.name}?</h2>
      <p class="text-muted-foreground text-sm">
        It moves to the Trash. You can restore it from Trash.
      </p>
      <form method="POST" action="?/delete" class="flex justify-end gap-2">
        <input type="hidden" name="id" value={data.division.id} />
        <Button href={recordHref} variant="outline">Cancel</Button>
        <Button type="submit" variant="destructive">Delete</Button>
      </form>
    </section>
  {/if}

  <div class="bg-card flex flex-col overflow-hidden rounded-xl border">
    <DivisionView
      division={data.division}
      permissions={data.permissions}
      ondelete={() => (confirmOpen = true)}
    />
  </div>
</Page>

<DeleteDivisionDialog
  bind:open={confirmOpen}
  target={data.division}
  action="?/delete"
  ondeleted={(division) => toast.success(`${division.name} moved to Trash`)}
/>
