<!--
  A User's full page (#304). Users keep full pages rather than a layer over the
  list: their form has three sections and a password. Delete asks first in a
  dialog, or without JavaScript on the page itself (`?delete`); a Trashed user
  shows read-only with Restore. A user out of the caller's reach shows read-only
  too, and `?delete` asks nothing of them.
-->
<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { postRowAction } from "$lib/components/list/row-action.js";
  import Notice from "$lib/components/Notice.svelte";
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import DeleteUserDialog from "$lib/master/DeleteUserDialog.svelte";
  import UserView from "$lib/master/UserView.svelte";
  import { USER_STATUS_LABELS, type User } from "@vmb/types";
  import { toast } from "svelte-sonner";
  import type { PageData } from "./$types.js";

  let { data, form }: { data: PageData; form: { error?: string; code?: string } | null } = $props();

  let confirmOpen = $state(false);

  // as from the list: the toast offers Undo to whoever may restore
  function deleted(user: Pick<User, "id" | "name">) {
    toast.success(`${user.name} moved to Trash`, {
      duration: 10_000,
      action: data.permissions.includes("master-users.restore")
        ? {
            label: "Undo",
            onClick: async () => {
              const result = await postRowAction(`${resolve("/master/users")}?/restore`, user.id);
              if (!result.ok) return void toast.error(result.error);
              toast.success(`${user.name} restored`);
              await invalidateAll();
            }
          }
        : undefined
    });
  }

  const recordHref = $derived(resolve("/(app)/master/users/[id]", { id: data.user.id }));
  const askingDelete = $derived(
    data.confirmDelete &&
      !data.user.deletedAt &&
      data.user.withinReach &&
      data.permissions.includes("master-users.delete")
  );
</script>

<svelte:head>
  <title>{data.user.name} — VMB</title>
</svelte:head>

<Page width="narrow" class="flex flex-col gap-4">
  <!-- the status in words, and the email they sign in with -->
  <PageHeader
    title={data.user.name}
    description="{data.user.email} · {data.user.deletedAt
      ? 'In the Trash'
      : USER_STATUS_LABELS[data.user.status]}"
  />

  {#if form?.error}
    <Notice variant="destructive">{form.error}</Notice>
  {/if}

  {#if askingDelete}
    <section
      aria-labelledby="delete-title"
      class="border-destructive/30 bg-destructive/5 flex flex-col gap-3 rounded-xl border p-4"
    >
      <h2 id="delete-title" class="font-semibold">Delete {data.user.name}?</h2>
      <p class="text-muted-foreground text-sm">
        It moves to the Trash, where you can restore it. Their sessions end now.
      </p>
      <form method="POST" action="?/delete" class="flex justify-end gap-2">
        <input type="hidden" name="id" value={data.user.id} />
        <Button href={recordHref} variant="outline">Cancel</Button>
        <Button type="submit" variant="destructive">Delete</Button>
      </form>
    </section>
  {/if}

  <div class="bg-background flex flex-col overflow-hidden rounded-xl border pt-3">
    <UserView
      user={data.user}
      permissions={data.permissions}
      ondelete={() => (confirmOpen = true)}
    />
  </div>
</Page>

<DeleteUserDialog
  bind:open={confirmOpen}
  target={data.user}
  action="?/delete"
  ondeleted={deleted}
/>
