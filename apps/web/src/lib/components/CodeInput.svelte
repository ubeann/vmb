<!--
  The one-time code, drawn as one box per digit. It is a single real input
  underneath (bits-ui's PinInput), so the browser's autofill, paste and the
  keyboard treat it as one field, and a screen reader hears one field named by
  its label.

  The input is invisible and relies on JavaScript to draw the boxes, so until
  the page has hydrated a plain six-digit field stands in. It takes the same
  `name` and `id`, so the form posts the same value either way (ADR-0007).
-->
<script lang="ts">
  import { OTP_LENGTH } from "@vmb/types";
  import { onMount, tick } from "svelte";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as InputOTP from "$lib/components/ui/input-otp/index.js";
  import { cn } from "$lib/utils.js";

  let {
    id,
    name,
    value = $bindable(""),
    inputRef = $bindable(null),
    invalid = false,
    "aria-describedby": describedby,
    onComplete
  }: {
    id: string;
    name: string;
    value?: string;
    inputRef?: HTMLInputElement | null;
    invalid?: boolean;
    "aria-describedby"?: string;
    // Called when the last digit is entered.
    onComplete?: () => void;
  } = $props();

  // False on the server and until the page has hydrated.
  let enhanced = $state(false);
  onMount(async () => {
    // The plain field is replaced, not restyled: carry the focus over.
    const hadFocus = !!inputRef && document.activeElement === inputRef;
    enhanced = true;
    if (!hadFocus) return;
    await tick();
    inputRef?.focus();
  });

  // The registry's root binds its wrapper, not the input inside it.
  let root = $state<HTMLElement | null>(null);
  $effect(() => {
    if (!root) return;
    inputRef = root.querySelector("input");
    return () => {
      inputRef = null;
    };
  });

  // What the input accepts as it is typed. Its own bound is `maxlength`.
  const DIGITS_ONLY = "^\\d+$";

  // Pasted "123 456" or "123-456" keeps the digits.
  const digitsOnly = (text: string) => text.replace(/\D/g, "");

  // The registry's slot colours an invalid box through `aria-invalid`, which a
  // box (a div) must not carry. The field's own `aria-invalid` is on the input,
  // and the box says so through `data-invalid`, which app.css reads for the
  // active box's ring.
  const invalidSlotClass = "border-destructive data-active:border-destructive";
</script>

{#if enhanced}
  <InputOTP.Root
    inputId={id}
    {name}
    bind:value
    bind:ref={root}
    maxlength={OTP_LENGTH}
    pattern={DIGITS_ONLY}
    pasteTransformer={digitsOnly}
    {onComplete}
    aria-invalid={invalid ? "true" : undefined}
    aria-describedby={describedby}
    required
  >
    {#snippet children({ cells })}
      <InputOTP.Group class="w-full gap-2">
        {#each cells as cell, index (index)}
          <InputOTP.Slot
            {cell}
            data-invalid={invalid ? "" : undefined}
            class={cn(
              "border-input size-auto h-11 min-w-0 flex-1 rounded-lg border text-base",
              invalid && invalidSlotClass
            )}
          />
        {/each}
      </InputOTP.Group>
    {/snippet}
  </InputOTP.Root>
{:else}
  <Input
    {id}
    {name}
    bind:value
    bind:ref={inputRef}
    class="min-h-11 font-mono tracking-[0.3em]"
    inputmode="numeric"
    autocomplete="one-time-code"
    maxlength={OTP_LENGTH}
    pattern={`\\d{${OTP_LENGTH}}`}
    aria-invalid={invalid ? "true" : undefined}
    aria-describedby={describedby}
    required
  />
{/if}
