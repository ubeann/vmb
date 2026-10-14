<!--
  Delete always asks first (ADR-0051 rule 8), from a row's menu and from the
  Division's own view alike, and says it can come back from the Trash. A
  Division still in use stays in the dialog with the refusal and the way out.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import Notice from "$lib/components/Notice.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import type { Division } from "@vmb/types";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { toast } from "svelte-sonner";

  let {
    open = $bindable(false),
    target,
    action,
    ondeleted
  }: {
    open?: boolean;
    target: Pick<Division, "id" | "name"> | null;
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
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Delete {target?.name}?</Dialog.Title>
      <Dialog.Description>It moves to the Trash. You can restore it from Trash.</Dialog.Description>
    </Dialog.Header>
    {#if refusal}
      <Notice variant="destructive">
        {refusal}
        <a href={resolve("/master/roles")} class="font-medium underline underline-offset-2"
          >Go to Roles</a
        >
      </Notice>
    {/if}
    <form method="POST" {action} use:enhance={submit}>
      <input type="hidden" name="id" value={target?.id ?? ""} />
      <Dialog.Footer>
        <Dialog.Close>
          {#snippet child({ props })}
            <Button {...props} data-slot="button" variant="outline">Cancel</Button>
          {/snippet}
        </Dialog.Close>
        <Button type="submit" variant="destructive" disabled={deleting}>
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
