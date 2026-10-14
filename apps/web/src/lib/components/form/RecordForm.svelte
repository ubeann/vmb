<!--
  A record's create or edit form (#302), the same in a layer and on a full
  page: its fields scroll between the top and a footer that holds Cancel and
  the one primary action. A message for the whole form (the API refused, or
  could not be reached) leads the fields; each field's own error sits under
  it. Its "Discard changes?" guard asks before the layer closes or the page is
  left with unsaved edits.
-->
<script lang="ts" generics="T extends Record<string, unknown>">
  import LayerBody from "$lib/components/list/layer/LayerBody.svelte";
  import LayerFooter from "$lib/components/list/layer/LayerFooter.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import SubmitButton from "$lib/components/SubmitButton.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import type { Snippet } from "svelte";
  import type { SuperForm } from "sveltekit-superforms";
  import DiscardDialog from "./DiscardDialog.svelte";
  import type { DiscardGuard } from "./discard.svelte.js";

  let {
    superform,
    guard,
    action,
    submitLabel,
    pendingLabel,
    cancelHref,
    oncancel,
    children
  }: {
    superform: SuperForm<T>;
    guard: DiscardGuard;
    /** The route whose action saves it, where that isn't the page the form is on (a layer over the list). */
    action?: string;
    submitLabel: string;
    pendingLabel: string;
    /** Where Cancel leads on a full page; the guard asks on the way. */
    cancelHref?: string;
    /** What Cancel does in a layer: asks the layer to close. */
    oncancel?: () => void;
    children: Snippet;
  } = $props();

  // svelte-ignore state_referenced_locally
  const { enhance, message, submitting, delayed } = superform;
</script>

<form method="POST" {action} use:enhance class="flex min-h-0 flex-1 flex-col">
  <LayerBody class="flex flex-col gap-5 p-4">
    {#if $message}
      <Notice variant="destructive">{$message}</Notice>
    {/if}
    {@render children()}
  </LayerBody>
  <LayerFooter>
    {#if oncancel}
      <Button variant="outline" class="in-data-[layer-frame=modal]:h-11" onclick={oncancel}
        >Cancel</Button
      >
    {:else if cancelHref}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the page passes a resolve()d path -->
      <Button variant="outline" class="in-data-[layer-frame=modal]:h-11" href={cancelHref}
        >Cancel</Button
      >
    {/if}
    <SubmitButton class="w-auto min-w-0 flex-1" pending={$submitting} slow={$delayed} {pendingLabel}
      >{submitLabel}</SubmitButton
    >
  </LayerFooter>
</form>

<DiscardDialog {guard} />
