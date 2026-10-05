<script lang="ts">
  import "../app.css";
  import { ModeWatcher } from "mode-watcher";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<!-- Hex `--background` from app.css (ADR-0036): browser chrome cannot read CSS variables. -->
<ModeWatcher themeColors={{ light: "#faf8f3", dark: "#0a1030" }} />

<!-- The signed-in frame is the (app) group's layout; the signed-out pages bring their own. -->
{@render children()}
