<!--
  PROTOTYPE (prototype/list-kit): four takes on the Divisions list, switchable via ?variant=.
  A is today's list (#340 + ADR-0050). B is every rule decided in the 2026-10-09 grilling,
  with today's saturated tiles; C and D are B with tinted and glyph-only tiles (Q4).
  Throwaway; never merge.
-->
<script lang="ts">
  import { page } from "$app/state";
  import PrototypeSwitcher from "$lib/components/PrototypeSwitcher.svelte";
  import VariantA from "./VariantA.svelte";
  import VariantB from "./VariantB.svelte";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  // Round 2: Q4 settled on tinted (C), so B and D leave the switcher (still reachable by URL);
  // C1–C4 explore the desktop toolbar
  // Round 3: the toolbar settled on C3; C3g/C3o/C3n try colours for the filters in use.
  // C1, C2 and C4 leave the switcher (still reachable by URL).
  const VARIANTS = [
    { key: "A", name: "Today (#340 + ADR-0050)" },
    { key: "C3g", name: "In the card, green chips" },
    { key: "C3o", name: "In the card, white chips" },
    { key: "C3n", name: "In the card, navy chips" },
    { key: "C3s", name: "Green chips, date picker beside" },
    { key: "C3v", name: "C3s + View panel and row shortcuts" }
  ];
  const variant = $derived(page.url.searchParams.get("variant") ?? "A");
</script>

<svelte:head>
  <title>Divisions prototype {variant} — VMB</title>
</svelte:head>

{#if variant === "A"}
  <VariantA {data} />
{:else if variant === "C" || variant === "C1"}
  <VariantB {data} tile="tint" toolbar="row" />
{:else if variant === "C2"}
  <VariantB {data} tile="tint" toolbar="filter" />
{:else if variant === "C3" || variant === "C3g"}
  <VariantB {data} tile="tint" toolbar="card" chip="green" />
{:else if variant === "C3o"}
  <VariantB {data} tile="tint" toolbar="card" chip="outline" />
{:else if variant === "C3v"}
  <VariantB {data} tile="tint" toolbar="card" chip="green" dates="beside" view />
{:else if variant === "C3s"}
  <VariantB {data} tile="tint" toolbar="card" chip="green" dates="beside" />
{:else if variant === "C3n"}
  <VariantB {data} tile="tint" toolbar="card" chip="navy" />
{:else if variant === "C4"}
  <VariantB {data} tile="tint" toolbar="pills" />
{:else if variant === "D"}
  <VariantB {data} tile="glyph" />
{:else}
  <VariantB {data} tile="solid" />
{/if}

<PrototypeSwitcher variants={VARIANTS} />
