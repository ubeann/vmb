<!--
  A record's create or edit form (#302), the same in a layer and on a full
  page: its fields scroll on a card between the top and a footer that holds
  Cancel and the one primary action. A message for the whole form (the API refused, or
  could not be reached) leads the fields; each field's own error sits under
  it. Its "Discard changes?" guard asks before the layer closes or the page is
  left with unsaved edits.
-->
<script lang="ts" generics="T extends Record<string, unknown>">
  import LayerCard from "$lib/components/list/layer/LayerCard.svelte";
  import LayerFooter from "$lib/components/list/layer/LayerFooter.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import SubmitButton from "$lib/components/SubmitButton.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import type { Component, Snippet } from "svelte";
  import type { SuperForm } from "sveltekit-superforms";
  import DiscardDialog from "./DiscardDialog.svelte";
  import type { DiscardGuard } from "./discard.svelte.js";

  let {
    superform,
    guard,
    action,
    submitLabel,
    pendingLabel,
    submitIcon,
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
    /** The submit's icon, which the spinner takes the place of while it sends. */
    submitIcon?: Component<{ class?: string; "aria-hidden"?: "true" }>;
    /** Where Cancel leads on a full page; the guard asks on the way. */
    cancelHref?: string;
    /** What Cancel does in a layer: asks the layer to close. */
    oncancel?: () => void;
    children: Snippet;
  } = $props();

  // svelte-ignore state_referenced_locally
  const { enhance, message, submitting, delayed } = superform;

  // a phone's full-screen form fills its footer; from 480px, a dialog's buttons sit at the right
  const CANCEL = "in-data-[layer-frame=modal]:h-11 min-[480px]:ml-auto";
</script>

<form method="POST" {action} use:enhance class="flex min-h-0 flex-1 flex-col">
  <LayerCard class="gap-5">
    {#if $message}
      <Notice variant="destructive">{$message}</Notice>
    {/if}
    {@render children()}
  </LayerCard>
  <!-- the card ends the fields, so the footer needs no line of its own -->
  <LayerFooter class="border-t-0">
    {#if oncancel}
      <Button variant="outline" class={CANCEL} onclick={oncancel}>Cancel</Button>
    {:else if cancelHref}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the page passes a resolve()d path -->
      <Button variant="outline" class={CANCEL} href={cancelHref}>Cancel</Button>
    {/if}
    <SubmitButton
      class="w-auto min-w-0 flex-1 min-[480px]:flex-none"
      pending={$submitting}
      slow={$delayed}
      icon={submitIcon}
      {pendingLabel}>{submitLabel}</SubmitButton
    >
  </LayerFooter>
</form>

<DiscardDialog {guard} />
