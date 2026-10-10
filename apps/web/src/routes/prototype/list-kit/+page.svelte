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
    { key: "C3v", name: "C3s + View panel and row shortcuts" },
    { key: "C3w", name: "C3v, Clear all beside the chips" },
    { key: "C3x", name: "C3v, the count leads the strip" },
    { key: "C3y", name: "C3w + reworked search" },
    { key: "C3r", name: "C3y + responsive card" },
    { key: "C3t", name: "C3r + icon tools when narrow" },
    { key: "C3h", name: "C3t + sort menu for two-line rows" },
    { key: "C3p", name: "C3t + 16px tablet padding" },
    { key: "C3q", name: "C3p + icon-rail sidebar under 1024px" },
    { key: "C3k", name: "C3q + View holds sort on narrow" },
    { key: "C3ka", name: "C3k, search dressed like the tools" },
    { key: "C3kb", name: "C3k, tools dressed like the search" },
    { key: "C3kc", name: "C3k, search and tools meet halfway" },
    { key: "C3kr", name: "C3kc + corners scaled to height" },
    { key: "C3km", name: "C3kr, middle band: the date takes the room" },
    { key: "C3kd", name: "C3kr, middle band: description under the name" },
    { key: "C3kn", name: "C3kd + keyboard row navigation" }
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
{:else if variant === "C3w"}
  <VariantB {data} tile="tint" toolbar="card" chip="green" dates="beside" view strip="inline" />
{:else if variant === "C3kr" || variant === "C3km" || variant === "C3kd" || variant === "C3kn"}
  <VariantB
    middle={variant === "C3km"
      ? "date"
      : variant === "C3kd" || variant === "C3kn"
        ? "desc"
        : "name"}
    rowNav={variant === "C3kn"}
    {data}
    tile="tint"
    toolbar="card"
    chip="green"
    dates="beside"
    view
    strip="inline"
    searchBox
    responsive
    compactTools
    tabletPadding
    sortInView
    toolTone="c"
    radius="scaled"
  />
{:else if variant === "C3ka" || variant === "C3kb" || variant === "C3kc"}
  <VariantB
    {data}
    tile="tint"
    toolbar="card"
    chip="green"
    dates="beside"
    view
    strip="inline"
    searchBox
    responsive
    compactTools
    tabletPadding
    sortInView
    toolTone={variant === "C3ka" ? "a" : variant === "C3kb" ? "b" : "c"}
  />
{:else if variant === "C3k"}
  <VariantB
    {data}
    tile="tint"
    toolbar="card"
    chip="green"
    dates="beside"
    view
    strip="inline"
    searchBox
    responsive
    compactTools
    tabletPadding
    sortInView
  />
{:else if variant === "C3h"}
  <VariantB
    {data}
    tile="tint"
    toolbar="card"
    chip="green"
    dates="beside"
    view
    strip="inline"
    searchBox
    responsive
    compactTools
    sortBar
  />
{:else if variant === "C3p" || variant === "C3q"}
  <VariantB
    {data}
    tile="tint"
    toolbar="card"
    chip="green"
    dates="beside"
    view
    strip="inline"
    searchBox
    responsive
    compactTools
    tabletPadding
  />
{:else if variant === "C3t"}
  <VariantB
    {data}
    tile="tint"
    toolbar="card"
    chip="green"
    dates="beside"
    view
    strip="inline"
    searchBox
    responsive
    compactTools
  />
{:else if variant === "C3r"}
  <VariantB
    {data}
    tile="tint"
    toolbar="card"
    chip="green"
    dates="beside"
    view
    strip="inline"
    searchBox
    responsive
  />
{:else if variant === "C3y"}
  <VariantB
    {data}
    tile="tint"
    toolbar="card"
    chip="green"
    dates="beside"
    view
    strip="inline"
    searchBox
  />
{:else if variant === "C3x"}
  <VariantB {data} tile="tint" toolbar="card" chip="green" dates="beside" view strip="lead" />
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
