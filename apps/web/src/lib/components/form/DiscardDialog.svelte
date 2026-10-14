<!--
  "Discard changes?", asked by a form's DiscardGuard. Keep editing is the safe
  answer, so it takes focus, and Esc gives it; an alert dialog has no outside
  click to close it by.
-->
<script lang="ts">
  import { buttonVariants } from "$lib/components/ui/button/index.js";
  import DialogOverlay from "$lib/components/ui/dialog/dialog-overlay.svelte";
  import { AlertDialog } from "bits-ui";
  import type { DiscardGuard } from "./discard.svelte.js";

  let { guard }: { guard: DiscardGuard } = $props();

  let keep = $state<HTMLElement | null>(null);
</script>

<AlertDialog.Root open={guard.asking} onOpenChange={(open) => !open && guard.answer(false)}>
  <AlertDialog.Portal>
    <DialogOverlay />
    <AlertDialog.Content
      class="bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%_-_2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl p-4 text-sm ring-1 duration-100 outline-none sm:max-w-sm"
      onOpenAutoFocus={(event: Event) => {
        event.preventDefault();
        keep?.focus();
      }}
    >
      <div class="flex flex-col gap-2">
        <AlertDialog.Title class="text-base leading-none font-medium"
          >Discard changes?</AlertDialog.Title
        >
        <AlertDialog.Description class="text-muted-foreground text-sm"
          >Your edits haven't been saved. Discarding them can't be undone.</AlertDialog.Description
        >
      </div>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <AlertDialog.Cancel
          bind:ref={keep}
          class={buttonVariants({ variant: "outline" })}
          data-slot="button"
          onclick={() => guard.answer(false)}>Keep editing</AlertDialog.Cancel
        >
        <AlertDialog.Action
          class={buttonVariants({ variant: "destructive" })}
          data-slot="button"
          onclick={() => guard.answer(true)}>Discard</AlertDialog.Action
        >
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
