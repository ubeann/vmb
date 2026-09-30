<!--
  A password field with a leading lock icon and a show/hide toggle. The toggle
  keeps a stable name and reports its state through aria-pressed; switching the
  input's type leaves password-manager autofill and the form value untouched.
-->
<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import LockKeyhole from "@lucide/svelte/icons/lock-keyhole";
  import IconInput from "$lib/components/IconInput.svelte";
  import { cn } from "$lib/utils.js";
  import type { HTMLInputAttributes } from "svelte/elements";

  let {
    id,
    class: className,
    ...restProps
  }: Omit<HTMLInputAttributes, "type" | "id" | "files"> & { id: string } = $props();

  let visible = $state(false);
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
      class="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
      aria-label="Show password"
      aria-controls={id}
      aria-pressed={visible}
      onclick={() => (visible = !visible)}
    >
      {#if visible}
        <EyeOff class="size-4" aria-hidden="true" />
      {:else}
        <Eye class="size-4" aria-hidden="true" />
      {/if}
    </button>
  {/snippet}
</IconInput>
