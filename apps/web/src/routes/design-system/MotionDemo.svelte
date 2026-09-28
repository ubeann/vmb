<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import { prefersReducedMotion } from "svelte/motion";
  import { slide } from "svelte/transition";

  let open = $state(false);
</script>

<div class="grid gap-6 sm:grid-cols-2">
  <div class="space-y-3">
    <p class="text-muted-foreground text-sm">
      Reduced motion is {prefersReducedMotion.current ? "on" : "off"} in this browser.
    </p>
    <Button
      variant="outline"
      aria-expanded={open}
      aria-controls="motion-panel"
      onclick={() => (open = !open)}>{open ? "Hide details" : "Show details"}</Button
    >
    {#if open}
      <div
        id="motion-panel"
        data-testid="motion-panel"
        class="rounded-lg border p-4 text-sm"
        transition:slide={{ duration: prefersReducedMotion.current ? 0 : 200 }}
      >
        Svelte transitions run on the Web Animations API, which the global CSS rule can't reach, so
        this one reads <code class="font-mono">prefersReducedMotion</code> and drops to 0 ms.
      </div>
    {/if}
  </div>
  <div class="space-y-3">
    <p class="text-muted-foreground text-sm">
      A spinner freezes under reduced motion, so the text carries the meaning.
    </p>
    <p role="status" class="inline-flex items-center gap-2 text-sm">
      <LoaderCircleIcon class="text-muted-foreground size-4 animate-spin" aria-hidden="true" />
      Loading…
    </p>
  </div>
</div>
