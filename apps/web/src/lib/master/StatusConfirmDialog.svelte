<!--
  Asked when a save would stop a user signing in, by making them Suspended or
  Inactive (#304): their sessions end when it saves, so whoever is signed in as
  them is signed out at once. Keep editing is the safe answer, so it takes
  focus. `ask` resolves with the answer, which the form waits on before it
  sends the save.
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
  import DialogOverlay from "$lib/components/ui/dialog/dialog-overlay.svelte";
  import { cn } from "$lib/utils.js";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
  import { AlertDialog } from "bits-ui";
  import { USER_STATUS_LABELS, type UserStatus } from "@vmb/types";

  let { name }: { name: string } = $props();

  let open = $state(false);
  let status = $state<Exclude<UserStatus, "active">>("suspended");
  let answer: ((save: boolean) => void) | null = null;
  let keep = $state<HTMLElement | null>(null);

  /** Opens the question for a save into `to`; resolves true to save, false to keep editing. */
  export function ask(to: Exclude<UserStatus, "active">): Promise<boolean> {
    // a second ask while one is open answers the first as "keep editing"
    answer?.(false);
    status = to;
    open = true;
    return new Promise((resolve) => (answer = resolve));
  }

  function reply(save: boolean) {
    const resolve = answer;
    answer = null;
    open = false;
    resolve?.(save);
  }
</script>

<AlertDialog.Root {open} onOpenChange={(next) => !next && reply(false)}>
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
      <ConfirmHalo icon={TriangleAlertIcon} tone="warning" />
      <div class={CONFIRM_TEXT}>
        <AlertDialog.Title class={CONFIRM_TITLE}
          >Make {name || "this user"} {USER_STATUS_LABELS[status]}?</AlertDialog.Title
        >
        <AlertDialog.Description class={CONFIRM_DESCRIPTION}
          >A {USER_STATUS_LABELS[status].toLowerCase()} user can't sign in. Saving ends their sessions
          now, so anyone signed in as them is signed out.</AlertDialog.Description
        >
      </div>
      <div class={CONFIRM_ACTIONS}>
        <AlertDialog.Cancel
          bind:ref={keep}
          class={buttonVariants({ variant: "outline" })}
          data-slot="button"
          onclick={() => reply(false)}>Keep editing</AlertDialog.Cancel
        >
        <AlertDialog.Action
          class={buttonVariants({ variant: "danger" })}
          data-slot="button"
          onclick={() => reply(true)}>Save and sign out</AlertDialog.Action
        >
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
