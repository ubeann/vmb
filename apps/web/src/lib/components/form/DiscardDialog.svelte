<!--
  "Discard changes?", asked by a form's DiscardGuard. It says what would be
  lost: the record's name and the fields changed on an edit, the new record on
  a create. Keep editing is the safe answer, so it takes focus, and Esc gives
  it; an alert dialog has no outside click to close it by. Discard is the
  danger button, as the one answer that can't be undone.
-->
<script lang="ts">
  import ConfirmHalo from "$lib/components/confirm/ConfirmHalo.svelte";
  import {
    CONFIRM_ACTIONS,
    CONFIRM_CONTENT,
    CONFIRM_DESCRIPTION,
    CONFIRM_TEXT,
    CONFIRM_TITLE
  } from "$lib/components/confirm/confirm.js";
  import { buttonVariants } from "$lib/components/ui/button/index.js";
  import { cn } from "$lib/utils.js";
  import DialogOverlay from "$lib/components/ui/dialog/dialog-overlay.svelte";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
  import { AlertDialog } from "bits-ui";
  import type { DiscardGuard } from "./discard.svelte.js";

  let {
    guard,
    title = "Discard changes?",
    description = "Your edits haven't been saved. Discarding them can't be undone."
  }: {
    guard: DiscardGuard;
    /** Names what would be lost: "Discard changes to Finance?" */
    title?: string;
    /** Says what it is: "You changed the name and code. They haven't been saved." */
    description?: string;
  } = $props();

  let keep = $state<HTMLElement | null>(null);
</script>

<AlertDialog.Root open={guard.asking} onOpenChange={(open) => !open && guard.answer(false)}>
  <AlertDialog.Portal>
    <DialogOverlay />
    <AlertDialog.Content
      class={cn(
        "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 fixed top-1/2 left-1/2 z-50 w-full max-w-[calc(100%_-_2rem)] -translate-x-1/2 -translate-y-1/2 text-sm ring-1 duration-100 outline-none",
        CONFIRM_CONTENT
      )}
      onOpenAutoFocus={(event: Event) => {
        event.preventDefault();
        keep?.focus();
      }}
    >
      <!-- amber: nothing is removed from the record, but what was typed is lost -->
      <ConfirmHalo icon={TriangleAlertIcon} tone="warning" />
      <div class={CONFIRM_TEXT}>
        <AlertDialog.Title class={CONFIRM_TITLE}>{title}</AlertDialog.Title>
        <AlertDialog.Description class={CONFIRM_DESCRIPTION}>{description}</AlertDialog.Description>
      </div>
      <div class={CONFIRM_ACTIONS}>
        <AlertDialog.Cancel
          bind:ref={keep}
          class={buttonVariants({ variant: "outline" })}
          data-slot="button"
          onclick={() => guard.answer(false)}>Keep editing</AlertDialog.Cancel
        >
        <AlertDialog.Action
          class={buttonVariants({ variant: "danger" })}
          data-slot="button"
          onclick={() => guard.answer(true)}
          ><Trash2Icon aria-hidden="true" data-icon="inline-start" />Discard</AlertDialog.Action
        >
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
