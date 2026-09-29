<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import Check from "$lib/components/movingicons/check.svelte";
  import Copy from "$lib/components/movingicons/copy.svelte";
  import RefreshCw from "$lib/components/movingicons/refresh-cw.svelte";
  import Settings from "$lib/components/movingicons/settings.svelte";

  let copied = $state(false);
  let refreshing = $state(false);
  let settingsOpen = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  function handleCopy() {
    copied = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copied = false), 1500);
  }

  function handleRefresh() {
    refreshing = true;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => (refreshing = false), 900);
  }
</script>

<div class="space-y-3">
  <p class="text-muted-foreground text-sm">
    Motion carries meaning here: copy → check, a refresh in progress, a settings panel opening.
    They're plain CSS, so the global reduced-motion rule collapses them without a JS gate.
  </p>
  <div class="flex flex-wrap items-center gap-3">
    <Button variant="outline" onclick={handleCopy}>
      {#if copied}
        <Check animate class="text-primary" />
      {:else}
        <Copy />
      {/if}
      {copied ? "Copied" : "Copy"}
    </Button>
    <Button variant="outline" onclick={handleRefresh} disabled={refreshing}>
      <RefreshCw animate={refreshing} />
      {refreshing ? "Refreshing…" : "Refresh"}
    </Button>
    <Button
      variant="outline"
      aria-expanded={settingsOpen}
      aria-controls="animated-icons-settings-panel"
      onclick={() => (settingsOpen = !settingsOpen)}
    >
      <Settings animate={settingsOpen} />
      Settings
    </Button>
  </div>
  {#if settingsOpen}
    <p
      id="animated-icons-settings-panel"
      class="text-muted-foreground rounded-lg border p-3 text-sm"
    >
      The gear rotates open while this panel is shown, and back while it's hidden.
    </p>
  {/if}
</div>
