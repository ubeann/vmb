<script lang="ts">
  import "../app.css";
  import { ModeWatcher } from "mode-watcher";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<!-- Hex `--background` from app.css (ADR-0036): browser chrome cannot read CSS variables.
     The first-paint script is app.html's, which can carry the CSP nonce (ADR-0047). -->
<ModeWatcher themeColors={{ light: "#faf8f3", dark: "#0a1030" }} disableHeadScriptInjection />

<!-- The signed-in frame is the (app) group's layout; the signed-out pages bring their own. -->
{@render children()}
