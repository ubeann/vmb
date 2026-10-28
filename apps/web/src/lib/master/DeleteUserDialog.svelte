<!--
  Delete always asks first (ADR-0051 rule 8), from a row's menu and from the
  User's own page alike, and says it can come back from the Trash. It shows
  the User as their row does, so it is plain which one goes, and says that
  deleting ends their sessions. A refusal (a user holding permissions the
  caller lacks) stays in the dialog beside the choice it blocks.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmHalo from "$lib/components/confirm/ConfirmHalo.svelte";
  import {
    CONFIRM_ACTIONS,
    CONFIRM_CONTENT,
    CONFIRM_DESCRIPTION,
    CONFIRM_TEXT,
    CONFIRM_TITLE
  } from "$lib/components/confirm/confirm.js";
  import Notice from "$lib/components/Notice.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import type { User } from "@vmb/types";
  import type { SubmitFunction } from "$app/forms";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { toast } from "svelte-sonner";

  let {
    open = $bindable(false),
    target,
    action,
    ondeleted
  }: {
    open?: boolean;
    /** The User to delete, as their row shows them. */
    target: Pick<User, "id" | "name" | "email" | "profilePhotoPath"> | null;
    /** The route action that deletes them, such as `?/delete`. */
    action: string;
    /** Once they are in the Trash, before the page follows the action's answer. */
    ondeleted: (user: Pick<User, "id" | "name">) => void;
  } = $props();

  let deleting = $state(false);
  // why the API refused the delete, shown in the dialog beside the choice it blocks
  let refusal = $state<string | null>(null);

  $effect(() => {
    if (open) refusal = null;
  });

  const submit: SubmitFunction = () => {
    const user = target;
    deleting = true;
    refusal = null;
    return async ({ result, update }) => {
      deleting = false;
      if (result.type === "failure") {
        const error = String(result.data?.error ?? "Something went wrong. Please try again.");
        // the user stays out of reach, so the way to go on is named here
        if (result.data?.code === "PERMISSION_ESCALATION") refusal = error;
        else toast.error(error);
        return;
      }
      open = false;
      if ((result.type === "success" || result.type === "redirect") && user) ondeleted(user);
      await update();
    };
  };
</script>

<Dialog.Root bind:open>
  <Dialog.Content showCloseButton={false} class={CONFIRM_CONTENT}>
    <ConfirmHalo icon={Trash2Icon} />
    <div class={CONFIRM_TEXT}>
      <Dialog.Title class={CONFIRM_TITLE}>Delete {target?.name}?</Dialog.Title>
      <Dialog.Description class={CONFIRM_DESCRIPTION}
        >It moves to the Trash, where you can restore it. Their sessions end now.</Dialog.Description
      >
    </div>
    <!-- the user themselves, as their row shows them, so it is plain which one goes -->
    {#if target}
      <div
        data-slot="confirm-record"
        class="bg-muted/60 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
      >
        <UserAvatar seed={target.id} image={target.profilePhotoPath} class="size-9" />
        <div class="flex min-w-0 flex-col">
          <span class="truncate font-medium">{target.name}</span>
          <span class="text-muted-foreground truncate text-xs">{target.email}</span>
        </div>
      </div>
    {/if}
    {#if refusal}
      <Notice variant="destructive" class="text-left">{refusal}</Notice>
    {/if}
    <form method="POST" {action} use:enhance={submit} class={CONFIRM_ACTIONS}>
      <input type="hidden" name="id" value={target?.id ?? ""} />
      <Dialog.Close>
        {#snippet child({ props })}
          <Button {...props} data-slot="button" variant="outline">Cancel</Button>
        {/snippet}
      </Dialog.Close>
      <Button type="submit" variant="danger" disabled={deleting}>
        <Trash2Icon aria-hidden="true" data-icon="inline-start" />
        {deleting ? "Deleting…" : "Delete"}
      </Button>
    </form>
  </Dialog.Content>
</Dialog.Root>
