<!--
  Delete always asks first (ADR-0051 rule 8), from a row's menu and from the
  Division's own view alike, and says it can come back from the Trash. It
  shows the Division as its row does, so it is plain which one goes. A
  Division still in use stays in the dialog with the refusal and the way out.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import ConfirmHalo from "$lib/components/confirm/ConfirmHalo.svelte";
  import {
    CONFIRM_ACTIONS,
    CONFIRM_CONTENT,
    CONFIRM_DESCRIPTION,
    CONFIRM_TEXT,
    CONFIRM_TITLE
  } from "$lib/components/confirm/confirm.js";
  import RecordTile from "$lib/components/list/RecordTile.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import type { Division } from "@vmb/types";
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
    /** The Division to delete, as its row shows it. */
    target: Pick<Division, "id" | "name" | "code" | "colorHex" | "iconName"> | null;
    /** The route action that deletes it, such as `?/delete`. */
    action: string;
    /** Once it is in the Trash, before the page follows the action's answer. */
    ondeleted: (division: Pick<Division, "id" | "name">) => void;
  } = $props();

  let deleting = $state(false);
  // why the API refused the delete, shown in the dialog beside the choice it blocks
  let refusal = $state<string | null>(null);

  $effect(() => {
    if (open) refusal = null;
  });

  const submit: SubmitFunction = () => {
    const division = target;
    deleting = true;
    refusal = null;
    return async ({ result, update }) => {
      deleting = false;
      if (result.type === "failure") {
        const error = String(result.data?.error ?? "Something went wrong. Please try again.");
        // a division still in use stays in the dialog, where the way out is named
        if (result.data?.code === "DIVISION_IN_USE") refusal = error;
        else toast.error(error);
        return;
      }
      open = false;
      if ((result.type === "success" || result.type === "redirect") && division)
        ondeleted(division);
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
        >It moves to the Trash, where you can restore it.</Dialog.Description
      >
    </div>
    <!-- the record itself, as its row shows it, so it is plain which one goes -->
    {#if target}
      <div
        data-slot="confirm-record"
        class="bg-muted/60 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
      >
        <RecordTile iconName={target.iconName} colorHex={target.colorHex} class="size-9" />
        <div class="flex min-w-0 flex-col">
          <span class="truncate font-medium">{target.name}</span>
          <span class="text-muted-foreground font-mono text-xs">{target.code}</span>
        </div>
      </div>
    {/if}
    {#if refusal}
      <Notice variant="destructive" class="text-left">
        {refusal}
        <a href={resolve("master/roles")} class="font-medium underline underline-offset-2"
          >Go to Roles</a
        >
      </Notice>
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
