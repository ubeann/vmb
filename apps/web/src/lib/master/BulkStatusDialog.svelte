<!--
  Switching several Divisions on or off asks first, as a bulk delete does
  (ADR-0051 rule 8, #467), and names how many and which way: Activate and
  Deactivate are two explicit targets, never a flip of each row, so a selection
  cannot end half-switched, and the batch is all or none. A refusal (a Division
  gone or in the Trash meanwhile) stays in the dialog; any other failure is a
  toast. Cancel is the safe answer and takes focus.
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
  import PowerIcon from "@lucide/svelte/icons/power";
  import PowerOffIcon from "@lucide/svelte/icons/power-off";
  import { toast } from "svelte-sonner";

  let {
    open = $bindable(false),
    ids,
    active,
    noun,
    action,
    returnFocus,
    onswitched
  }: {
    open?: boolean;
    /** The records to switch: one `ids` field each in the form. */
    ids: string[];
    /** The state they are switched to: true is Activate, false is Deactivate. */
    active: boolean;
    /** What they are: "division" and "divisions". */
    noun: CountNoun;
    /** The route action that switches them, such as `?/bulk`. */
    action: string;
    /** Where focus goes when the dialog closes, since the button that opened it is gone with the selection. */
    returnFocus?: () => HTMLElement | null;
    /** Once switched, with the records whose state changed (the ones an Undo puts back) and the state they were switched to. */
    onswitched: (changed: string[], chosen: string[], active: boolean) => void;
  } = $props();

  let switching = $state(false);
  // why the API refused the batch, shown in the dialog beside the choice it blocks
  let refusal = $state<string | null>(null);

  $effect(() => {
    if (open) refusal = null;
  });

  const one = $derived(ids.length === 1);
  const verb = $derived(active ? "Activate" : "Deactivate");
  const Icon = $derived(active ? PowerIcon : PowerOffIcon);

  const submit: SubmitFunction = () => {
    // Cancel stays live while the request runs, so the dialog may show another choice by the time it answers
    const chosen = [...ids];
    const chosenActive = active;
    switching = true;
    refusal = null;
    return async ({ result, update }) => {
      switching = false;
      if (result.type === "failure") {
        const error = String(result.data?.error ?? "Something went wrong. Please try again.");
        // a stale selection (404) is worth keeping in view; anything else is a passing toast
        if (result.status === 404) refusal = error;
        else toast.error(error);
        return;
      }
      if (open && chosenActive === active && chosen.join() === ids.join()) open = false;
      if (result.type === "success") {
        const changed = result.data?.ids;
        onswitched(Array.isArray(changed) ? (changed as string[]) : chosen, chosen, chosenActive);
      }
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
    <ConfirmHalo icon={Icon} tone={active ? "primary" : "warning"} />
    <div class={CONFIRM_TEXT}>
      <Dialog.Title class={CONFIRM_TITLE}
        >{verb} {ids.length} {nounFor(noun, ids.length)}?</Dialog.Title
      >
      <Dialog.Description class={CONFIRM_DESCRIPTION}
        >{active
          ? `${one ? "It becomes" : "They become"} Active.`
          : `${one ? "It stays" : "They stay"} in the list, marked Inactive.`}</Dialog.Description
      >
    </div>
    {#if refusal}
      <Notice variant="destructive" class="text-left">{refusal}</Notice>
    {/if}
    <form method="POST" {action} use:enhance={submit} class={CONFIRM_ACTIONS}>
      <input type="hidden" name="action" value={active ? "activate" : "deactivate"} />
      {#each ids as id (id)}
        <input type="hidden" name="ids" value={id} />
      {/each}
      <Dialog.Close>
        {#snippet child({ props })}
          <Button {...props} data-slot="button" variant="outline">Cancel</Button>
        {/snippet}
      </Dialog.Close>
      <Button type="submit" disabled={switching}>
        <Icon aria-hidden="true" data-icon="inline-start" />
        {switching ? (active ? "Activating…" : "Deactivating…") : verb}
      </Button>
    </form>
  </Dialog.Content>
</Dialog.Root>
