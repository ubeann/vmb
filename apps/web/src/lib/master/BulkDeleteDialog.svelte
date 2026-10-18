<!--
  Deleting several records asks first, as one does (ADR-0051 rule 8, #305), and
  names how many go and that they can come back from the Trash. The batch is
  all or none, so a refusal the page knows how to word (a Division still in use,
  a User out of reach) stays in the dialog, naming everything in the way; any other
  failure is a toast. Divisions and Users share it: each passes its noun and
  what else the delete does.
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
  import { nounFor, type CountNoun } from "$lib/master/list.js";
  import type { SubmitFunction } from "$app/forms";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import type { Snippet } from "svelte";
  import { toast } from "svelte-sonner";

  let {
    open = $bindable(false),
    ids,
    noun,
    action,
    note,
    refusalCodes,
    refusalHelp,
    returnFocus,
    ondeleted
  }: {
    open?: boolean;
    /** The records to delete: one `ids` field each in the form. */
    ids: string[];
    /** What they are: "division" and "divisions". */
    noun: CountNoun;
    /** The route action that deletes them, such as `?/bulk`. */
    action: string;
    /** What else the delete does, after "they move to the Trash": "Their sessions end now." */
    note?: string;
    /** The API codes whose refusal stays in the dialog, beside the choice it blocks. */
    refusalCodes: string[];
    /** The way out of a refusal, after its words: a link to the page that fixes it. */
    refusalHelp?: Snippet;
    /** Where focus goes when the dialog closes, since the button that opened it is gone with the selection. */
    returnFocus?: () => HTMLElement | null;
    /** Once they are in the Trash, before the page follows the action's answer. */
    ondeleted: (ids: string[]) => void;
  } = $props();

  let deleting = $state(false);
  // why the API refused the batch, shown in the dialog beside the choice it blocks
  let refusal = $state<string | null>(null);

  $effect(() => {
    if (open) refusal = null;
  });

  const submit: SubmitFunction = () => {
    const chosen = [...ids];
    deleting = true;
    refusal = null;
    return async ({ result, update }) => {
      deleting = false;
      if (result.type === "failure") {
        const error = String(result.data?.error ?? "Something went wrong. Please try again.");
        if (refusalCodes.includes(String(result.data?.code))) refusal = error;
        else toast.error(error);
        return;
      }
      open = false;
      if (result.type === "success" || result.type === "redirect") ondeleted(chosen);
      await update();
    };
  };
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    showCloseButton={false}
    class={CONFIRM_CONTENT}
    onCloseAutoFocus={(event) => {
      const target = returnFocus?.();
      if (!target) return;
      event.preventDefault();
      target.focus();
    }}
  >
    <ConfirmHalo icon={Trash2Icon} />
    <div class={CONFIRM_TEXT}>
      <Dialog.Title class={CONFIRM_TITLE}
        >Delete {ids.length} {nounFor(noun, ids.length)}?</Dialog.Title
      >
      <Dialog.Description class={CONFIRM_DESCRIPTION}
        >{ids.length === 1 ? "It moves" : "They move"} to the Trash, where you can restore {ids.length ===
        1
          ? "it"
          : "them"}.{note ? ` ${note}` : ""}</Dialog.Description
      >
    </div>
    {#if refusal}
      <Notice variant="destructive" class="text-left">
        {refusal}
        {@render refusalHelp?.()}
      </Notice>
    {/if}
    <form method="POST" {action} use:enhance={submit} class={CONFIRM_ACTIONS}>
      <input type="hidden" name="action" value="delete" />
      {#each ids as id (id)}
        <input type="hidden" name="ids" value={id} />
      {/each}
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
