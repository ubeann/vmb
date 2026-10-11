<!--
  The Divisions list inside the app shell, for the tests that need the sidebar's
  share of the screen: the list card's width depends on it (ADR-0051 rule 11).
-->
<script lang="ts">
  import AppShell from "$lib/components/AppShell.svelte";
  import Page from "./+page.svelte";
  import type { PageData } from "./$types.js";

  let {
    data,
    sidebarOpen,
    sidebarSaved
  }: { data: PageData; sidebarOpen: boolean; sidebarSaved: boolean } = $props();
</script>

<AppShell
  user={{ id: "u-1", name: "Siti Rahma", email: "siti@vmblogistics.id" }}
  division={null}
  {sidebarOpen}
  {sidebarSaved}
>
  <Page {data} />
</AppShell>
