<!--
  A Role's full page (#303): what the layer over the list shows, for a link
  opened directly, a reload or a browser without JavaScript. Delete asks first
  in a dialog, or without JavaScript on the page itself (`?delete`).
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import Notice from "$lib/components/Notice.svelte";
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import DeleteRoleDialog from "$lib/master/DeleteRoleDialog.svelte";
  import RoleView from "$lib/master/RoleView.svelte";
  import type { Role } from "@vmb/types";
  import { toast } from "svelte-sonner";
  import type { PageData } from "./$types.js";

  let { data, form }: { data: PageData; form: { error?: string; code?: string } | null } = $props();

  let confirmOpen = $state(false);

  // a Role has no Trash, so the toast has nothing to undo
  function deleted(role: Pick<Role, "id" | "name">) {
    toast.success(`${role.name} deleted`);
  }

  const recordHref = $derived(resolve("/(app)/master/roles/[id]", { id: data.role.id }));
  const askingDelete = $derived(
    data.confirmDelete && !data.role.isSystem && data.permissions.includes("master-roles.delete")
  );
</script>

<svelte:head>
  <title>{data.role.name} — VMB</title>
</svelte:head>

<Page width="narrow" class="flex flex-col gap-4">
  <!-- what kind of role it is and its status, as the layer's header line has them -->
  <PageHeader
    title={data.role.name}
    description="{data.role.isSystem ? 'System Role · ' : ''}{data.role.isActive
      ? 'Active'
      : 'Inactive'}"
  />

  {#if form?.error}
    <Notice variant="destructive">
      {form.error}
      {#if form.code === "ROLE_IN_USE"}
        <a href={resolve("/master/users")} class="font-medium underline underline-offset-2"
          >Go to Users</a
        >
      {/if}
    </Notice>
  {/if}

  {#if askingDelete}
    <section
      aria-labelledby="delete-title"
      class="border-destructive/30 bg-destructive/5 flex flex-col gap-3 rounded-xl border p-4"
    >
      <h2 id="delete-title" class="font-semibold">Delete {data.role.name} permanently?</h2>
      <p class="text-muted-foreground text-sm">This can't be undone.</p>
      <form method="POST" action="?/delete" class="flex justify-end gap-2">
        <input type="hidden" name="id" value={data.role.id} />
        <Button href={recordHref} variant="outline">Cancel</Button>
        <Button type="submit" variant="destructive">Delete permanently</Button>
      </form>
    </section>
  {/if}

  <div class="bg-background flex flex-col overflow-hidden rounded-xl border pt-3">
    <RoleView
      role={data.role}
      permissions={data.permissions}
      ondelete={() => (confirmOpen = true)}
    />
  </div>
</Page>

<DeleteRoleDialog
  bind:open={confirmOpen}
  target={data.role}
  action="?/delete"
  ondeleted={deleted}
/>
