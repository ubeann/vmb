<script lang="ts">
  import "../app.css";
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button/index.js";
  import { ModeWatcher } from "mode-watcher";
  import type { Snippet } from "svelte";
  import type { LayoutData } from "./$types.js";

  let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

<!-- Hex `--background` from app.css (ADR-0036): browser chrome cannot read CSS variables. -->
<ModeWatcher themeColors={{ light: "#faf8f3", dark: "#0a1030" }} />

{#if data.user}
  <nav>
    <a href={resolve("/")}>VMB</a>
    <a href={resolve("/master")}>Master</a>

    <form method="POST" action={resolve("/logout")}>
      <Button type="submit" variant="outline" class="min-h-11">Log out</Button>
    </form>
  </nav>
{/if}

{@render children()}
