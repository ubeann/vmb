<!--
  A form's submit button that reports its own send. While `pending` it keeps
  its colour and its focus, so the person who pressed it can see it working;
  `createSubmission` turns a second send away, which is why it isn't disabled.
  The spinner takes the icon's place and the label says what is happening, so
  the button still reads as busy when reduced motion stops the spinner
  (ADR-0035 rule 6). Once the send is `slow` the label says so, and a status
  line tells a screen reader to check the connection. That line is there only
  during a send, so a page keeps one status region at rest; it sits before the
  button and takes no room, so it adds no gap to the form.
-->
<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import { Button, type ButtonVariant } from "$lib/components/ui/button/index.js";
  import { cn } from "$lib/utils.js";
  import type { Component, Snippet } from "svelte";

  let {
    pending = false,
    slow = false,
    icon: Icon,
    pendingLabel,
    variant = "default",
    disabled = false,
    class: className,
    children
  }: {
    /** This button's form is being sent. */
    pending?: boolean;
    /** The send has taken long enough to say so. */
    slow?: boolean;
    icon?: Component<{ class?: string; "aria-hidden"?: "true" }>;
    /** What the button says while its form is sent, e.g. "Signing in…". */
    pendingLabel: string;
    variant?: ButtonVariant;
    /** For a wait the page sets, such as the resend countdown. */
    disabled?: boolean;
    class?: string;
    children: Snippet;
  } = $props();
</script>

{#if pending}
  <!-- Mounted empty as the send starts, so filling it is announced. -->
  <p role="status" class="sr-only">{slow ? "Still working. Check your connection." : ""}</p>
{/if}
<Button
  type="submit"
  {variant}
  class={cn(
    // 44px on every pointer, as the auth pages' fields are, and cornered as they are
    "min-h-11 w-full rounded-(--touch-radius) aria-disabled:pointer-events-auto aria-disabled:opacity-100",
    className
  )}
  {disabled}
  aria-busy={pending}
  aria-disabled={pending || undefined}
>
  {#if pending}
    <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
    {slow ? "Still working…" : pendingLabel}
  {:else}
    {#if Icon}<Icon class="size-4" aria-hidden="true" />{/if}
    {@render children()}
  {/if}
</Button>
