<!--
  PROTOTYPE (prototype/divisions): takes on the Divisions list, switchable via ?variant=, one
  file per variant (docs/agents/ui-prototype-round.md). A is today's master list on fixtures.
  Each owner pick goes in the commit message that records it. Throwaway; never merge.
-->
<script lang="ts">
  import { page } from "$app/state";
  import PrototypeSwitcher from "$lib/components/PrototypeSwitcher.svelte";
  import VariantA from "./VariantA.svelte";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  // B and C keep today's page and move the footer strip (the layout reads the key)
  const VARIANTS = [
    { key: "A", name: "Today: footer pinned under the panel" },
    { key: "B", name: "Footer at the end of the panel" },
    { key: "C", name: "Page scrolls, footer below the panel" },
    { key: "D", name: "C + a one-page list counts its rows" }
  ];
  const variant = $derived(page.url.searchParams.get("variant") ?? "A");
</script>

<svelte:head>
  <title>Divisions prototype {variant} — VMB</title>
</svelte:head>

{#if variant === "D"}
  <VariantA {data} wholeCount />
{:else if ["A", "B", "C"].includes(variant)}
  <VariantA {data} />
{/if}

<PrototypeSwitcher variants={VARIANTS} />
