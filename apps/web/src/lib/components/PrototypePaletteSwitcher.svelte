<!--
  PROTOTYPE, throwaway (light-mode palette, after #301 / PR #340). Lives on the
  prototype branch only; never merge it.

  Question: which light-mode surface palette lets the list kit read clean? The
  warm paper (ADR-0036) mixes warm neutrals (hue 88-93) with cool navy ones
  (hue 273) and stacks three near-identical surfaces: shell, panel, table.

  Four palettes, switchable via `?palette=a|b|c|d` on any page (the login page
  and /master/divisions are the two to judge). The variants differ only in
  light-mode tokens on purpose: colour is the question here, not layout. Dark
  mode is untouched in every variant. ← and → cycle, `m` toggles light and
  dark. The choice lives in localStorage, so it survives navigation and the
  list pages' canonical redirect, which drops unknown query params. Dev only.
-->
<script lang="ts">
  import { dev } from "$app/environment";
  import { afterNavigate, replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { mode, toggleMode } from "mode-watcher";

  const VARIANTS = [
    {
      key: "a",
      name: "Warm paper (current)",
      surfaces: { shell: "#f6f3ed", panel: "#faf8f3", table: "#ffffff" }
    },
    {
      key: "b",
      name: "Navy tint, framed panel",
      surfaces: { shell: "#f3f4f8", panel: "#fdfdfe", table: "#fdfdfe" }
    },
    {
      key: "c",
      name: "Navy tint, canvas + white cards",
      surfaces: { shell: "#fdfdfe", panel: "#f4f6f8", table: "#ffffff" }
    },
    {
      key: "d",
      name: "Neutral, framed panel",
      surfaces: { shell: "#f6f5f3", panel: "#fefdfd", table: "#fefdfd" }
    }
  ] as const;
  type Key = (typeof VARIANTS)[number]["key"];

  const STORAGE_KEY = "prototype-palette";
  const isKey = (value: string | null): value is Key => VARIANTS.some((v) => v.key === value);

  let current = $state<Key>("a");
  const variant = $derived(VARIANTS.find((v) => v.key === current) ?? VARIANTS[0]);

  function apply(key: Key) {
    current = key;
    document.documentElement.dataset.palette = key;
    localStorage.setItem(STORAGE_KEY, key);
    if (page.url.searchParams.get("palette") !== key) {
      const url = new URL(page.url);
      url.searchParams.set("palette", key);
      // eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype: same page, one query param
      replaceState(url, page.state);
    }
  }

  function step(by: number) {
    const index = VARIANTS.findIndex((v) => v.key === current);
    apply((VARIANTS[(index + by + VARIANTS.length) % VARIANTS.length] ?? VARIANTS[0]).key);
  }

  afterNavigate(() => {
    if (!dev) return;
    const fromUrl = page.url.searchParams.get("palette");
    const stored = localStorage.getItem(STORAGE_KEY);
    apply(isKey(fromUrl) ? fromUrl : isKey(stored) ? stored : "a");
  });

  function onkeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable]")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "ArrowLeft") step(-1);
    else if (event.key === "ArrowRight") step(1);
    else if (event.key === "m") toggleMode();
  }
</script>

<svelte:window {onkeydown} />

{#if dev}
  <div class="prototype-bar" role="toolbar" aria-label="Prototype palette switcher">
    <button type="button" onclick={() => step(-1)} aria-label="Previous palette">←</button>
    <span class="label"><strong>{variant.key.toUpperCase()}</strong> {variant.name}</span>
    <button type="button" onclick={() => step(1)} aria-label="Next palette">→</button>
    <span class="swatches" aria-hidden="true">
      {#each Object.entries(variant.surfaces) as [name, hex] (name)}
        <span class="chip"><i style:background={hex}></i>{name} {hex}</span>
      {/each}
    </span>
    <button type="button" onclick={toggleMode}>{mode.current === "dark" ? "Dark" : "Light"}</button>
  </div>
{/if}

<style>
  /* B: one navy-tinted neutral family (hue 264). The shell is the tint, the
     panel and the table share one near-white, so there are two layers. */
  :global(html[data-palette="b"]:not(.dark)) {
    --sidebar: oklch(0.968 0.005 264);
    --background: oklch(0.995 0.0015 264);
    --card: oklch(0.995 0.0015 264);
    --muted: oklch(0.955 0.006 264);
    --accent: oklch(0.94 0.009 264);
    --border: oklch(0.9 0.008 264);
    --sidebar-accent: oklch(0.94 0.009 264);
    --sidebar-border: oklch(0.9 0.008 264);
  }

  /* C: the same family, inverted: a bright frame, a tinted canvas for the
     panel, and pure white cards that lift off it. */
  :global(html[data-palette="c"]:not(.dark)) {
    --sidebar: oklch(0.995 0.0015 264);
    --background: oklch(0.972 0.004 264);
    --card: oklch(1 0 0);
    --muted: oklch(0.955 0.006 264);
    --accent: oklch(0.94 0.009 264);
    --border: oklch(0.9 0.008 264);
    --sidebar-accent: oklch(0.94 0.009 264);
    --sidebar-border: oklch(0.9 0.008 264);
  }

  /* D: B's two layers in a near-achromatic, barely warm grey (hue 90), to
     check whether temperature or the layer count was the problem. */
  :global(html[data-palette="d"]:not(.dark)) {
    --sidebar: oklch(0.97 0.003 90);
    --background: oklch(0.995 0.001 90);
    --card: oklch(0.995 0.001 90);
    --muted: oklch(0.955 0.004 90);
    --accent: oklch(0.94 0.005 90);
    --border: oklch(0.9 0.005 90);
    --sidebar-accent: oklch(0.94 0.005 90);
    --sidebar-border: oklch(0.9 0.005 90);
  }

  /* Deliberately off-system colours, so the bar never reads as part of the design. */
  .prototype-bar {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 0.75rem;
    transform: translateX(-50%);
    border-radius: 999px;
    background: #111;
    color: #fff;
    font:
      500 0.8125rem/1.2 ui-monospace,
      monospace;
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.35);
    white-space: nowrap;
  }
  .prototype-bar button {
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    background: #333;
    color: #fff;
    cursor: pointer;
  }
  .prototype-bar button:hover {
    background: #555;
  }
  .swatches {
    display: flex;
    gap: 0.6rem;
    opacity: 0.8;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .chip i {
    width: 0.8rem;
    height: 0.8rem;
    border: 1px solid #666;
    border-radius: 3px;
  }
</style>
