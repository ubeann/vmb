<!--
  A password field with a leading lock icon and a show/hide toggle. The toggle
  keeps a stable name and reports its state through aria-pressed; switching the
  input's type leaves password-manager autofill and the form value untouched.
  Pressing it while typing leaves focus and the caret in the field, so a phone
  keeps its keyboard open; from the keyboard, focus stays on the toggle.
-->
<script lang="ts">
  import LockKeyhole from "@lucide/svelte/icons/lock-keyhole";
  import EyeToggleIcon from "$lib/components/EyeToggleIcon.svelte";
  import IconInput from "$lib/components/IconInput.svelte";
  import { cn } from "$lib/utils.js";
  import { tick } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";

  let {
    id,
    class: className,
    ...restProps
  }: Omit<HTMLInputAttributes, "type" | "id" | "files"> & { id: string } = $props();

  let visible = $state(false);

  // Set when a pointer presses the toggle while the field has focus: the press
  // then doesn't take focus, and the caret goes back where it was. Switching
  // the type resets the selection, so it is put back after the swap. Only the
  // click that ends that press uses it: each press starts afresh, a cancelled
  // one drops it, and a click from the keyboard (detail 0) never reads it.
  let caret: [number | null, number | null] | undefined;

  const field = () => {
    const element = document.getElementById(id);
    return element instanceof HTMLInputElement ? element : undefined;
  };

  function keepFocus(event: PointerEvent) {
    caret = undefined;
    const input = field();
    if (!input || document.activeElement !== input) return;
    event.preventDefault();
    caret = [input.selectionStart, input.selectionEnd];
  }

  async function toggle(event: MouseEvent) {
    visible = !visible;
    const saved = event.detail > 0 ? caret : undefined;
    caret = undefined;
    if (!saved) return;
    const [start, end] = saved;
    // The browser rebuilds the field for its new type and resets the
    // selection a frame later, so the caret is put back after that frame.
    await tick();
    await new Promise(requestAnimationFrame);
    const input = field();
    if (!input) return;
    input.focus();
    input.setSelectionRange(start, end);
  }
</script>

<IconInput
  icon={LockKeyhole}
  {id}
  type={visible ? "text" : "password"}
  class={cn("pr-12", className)}
  {...restProps}
>
  {#snippet trailing()}
    <button
      type="button"
      data-slot="password-toggle"
      class="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-r-touch absolute inset-y-0 right-0 flex w-11 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
      aria-label="Show password"
      aria-controls={id}
      aria-pressed={visible}
      onpointerdown={keepFocus}
      onpointercancel={() => (caret = undefined)}
      onclick={toggle}
    >
      <EyeToggleIcon off={visible} class="size-4" />
    </button>
  {/snippet}
</IconInput>
