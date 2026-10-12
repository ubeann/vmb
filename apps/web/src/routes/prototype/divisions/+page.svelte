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

  const VARIANTS = [{ key: "A", name: "Today (master)" }];
  const variant = $derived(page.url.searchParams.get("variant") ?? "A");
</script>

<svelte:head>
  <title>Divisions prototype {variant} — VMB</title>
</svelte:head>

{#if variant === "A"}
  <VariantA {data} />
{/if}

<PrototypeSwitcher variants={VARIANTS} />
