<!--
  Every signed-in screen lives in this group, inside the app shell (#167). The
  gate in hooks.server.ts has already refused anyone without a session, so the
  `user` guard only narrows the type; the signed-out pages and the error page
  keep their own frames.
-->
<script lang="ts">
  import AppShell from "$lib/components/AppShell.svelte";
  import type { Snippet } from "svelte";
  import type { LayoutData } from "./$types.js";

  let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

{#if data.user}
  <AppShell user={data.user} division={data.division} sidebarOpen={data.sidebarOpen}>
    {@render children()}
  </AppShell>
{:else}
  {@render children()}
{/if}
