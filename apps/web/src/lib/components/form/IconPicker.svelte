<!--
  A record's icon, from the catalogue (#302, #176). At rest it offers one
  line of square tiles: the icon chosen, then those its name suggests
  ("Finance" gives the money ones), then common ones, and last a dashed More
  tile. More opens the catalogue in the form, as the colour picker opens,
  rather than over it: a search that knows synonyms ("money" finds Wallet)
  and one group at a time, so the panel needs no scroll of its own inside the
  card. The groups take one line: as many as
  fit, then "+N more", which opens the rest onto more lines.

  The icons are radios in one group, so the arrow keys move between them.
  They post nothing: the form's own field does, as the picker reports a pick.
-->
<script lang="ts">
  import HeroIcon from "$lib/components/HeroIcon.svelte";
  import { resolveIcon } from "$lib/components/hero-icons.js";
  import {
    CATALOG,
    CATEGORIES,
    catalogIcon,
    searchIcons,
    suggestIcons,
    type CatalogIcon,
    type IconName
  } from "$lib/components/icons/catalog.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import LayoutGridIcon from "@lucide/svelte/icons/layout-grid";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";
  import { cn } from "$lib/utils.js";
  import { tick } from "svelte";
  import { MediaQuery } from "svelte/reactivity";

  // what the row offers when the name suggests nothing yet
  const COMMON: IconName[] = [
    "building-2",
    "users",
    "banknote",
    "truck",
    "warehouse",
    "monitor",
    "megaphone",
    "shopping-cart",
    "settings"
  ];
  // a tile's side (size-9, as a field is tall; size-11 on touch) and the gap between tiles (gap-2)
  const TILE = 36;
  const TOUCH_TILE = 44;
  const TILE_GAP = 8;
  // the gap between chips (gap-1.5), and the room kept round the line for focus rings (p-1)
  const GAP = 6;
  const RING_ROOM = 4;
  const CHIP =
    "border-border text-muted-foreground hover:bg-muted aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background focus-visible:ring-ring h-7 shrink-0 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap outline-none focus-visible:ring-2 pointer-coarse:h-9";

  let {
    value,
    onpick,
    suggestFor = "",
    color
  }: {
    /** The stored name: a catalogue Lucide name, or a legacy Heroicons one. */
    value: string;
    onpick: (name: string) => void;
    /** The record's name, which the suggestions are for. */
    suggestFor?: string;
    /** The record's colour, which the chosen icon takes. */
    color: string;
  } = $props();

  const id = $props.id();
  let browsing = $state(false);
  let query = $state("");
  let category = $state<string>("suggested");
  let search = $state<HTMLInputElement | null>(null);
  let more = $state<HTMLElement | null>(null);
  let ruler = $state<HTMLElement | null>(null);
  let lineWidth = $state(0);
  let chipWidths = $state<number[]>([]);
  let groupsOpen = $state(false);
  let gridWidth = $state(0);
  // followed as it changes, as the stylesheet's pointer-coarse sizes do (a device toolbar, a tablet's keyboard)
  const touch = new MediaQuery("(pointer: coarse)", false);
  // the tiles one line of the grid holds, so the row at rest never wraps
  const perLine = $derived.by(() => {
    if (!gridWidth) return 9;
    const tile = touch.current ? TOUCH_TILE : TILE;
    return Math.max(4, Math.floor((gridWidth + TILE_GAP) / (tile + TILE_GAP)));
  });

  const selected = $derived(resolveIcon(value));
  // a stored icon the catalogue can't draw stays chosen, as its own option, until another is
  const kept = $derived(selected ? null : value);
  const suggested = $derived(suggestIcons(suggestFor));

  const unique = (icons: (CatalogIcon | undefined)[]) =>
    [...new Map(icons.filter((icon) => icon !== undefined).map((icon) => [icon.name, icon]))].map(
      ([, icon]) => icon
    );

  // the icon chosen, then the name's suggestions, then common ones, to fill one line beside More
  const row = $derived(
    unique([
      selected ? catalogIcon(selected) : undefined,
      ...suggested,
      ...COMMON.map(catalogIcon)
    ]).slice(0, Math.max(1, perLine - 1 - (kept ? 1 : 0)))
  );

  const chips = $derived([
    ...(suggested.length ? [{ id: "suggested", label: "Suggested" }] : []),
    ...CATEGORIES.map(({ id, label }) => ({ id, label }))
  ]);
  // the group shown when nothing is searched: Suggested while there is a suggestion
  const group = $derived(chips.some((chip) => chip.id === category) ? category : chips[0]!.id);
  const listed = $derived(
    query.trim()
      ? searchIcons(query)
      : group === "suggested"
        ? suggested
        : (CATEGORIES.find((each) => each.id === group)?.icons ?? [])
  );
  const shown = $derived(browsing ? listed : row);

  // the chips' own widths, and last the "+N more" one's, measured again as the chips or the
  // line change, and once the web font has loaded, which changes every width
  function measure() {
    if (!ruler) return;
    chipWidths = [...ruler.children].map((chip) => (chip as HTMLElement).offsetWidth);
  }
  $effect(() => {
    void chips;
    void lineWidth;
    measure();
  });
  $effect(() => {
    if (!browsing) return;
    let live = true;
    void document.fonts?.ready.then(() => live && measure());
    return () => {
      live = false;
    };
  });
  // measured, so the line can hold to one row; until then, or where it can't be, the chips wrap
  const measured = $derived(
    chipWidths.length === chips.length + 1 && chipWidths.every((width) => width > 0)
  );

  // The chips one line holds beside "+N more", in their order: the group shown
  // first, wherever it falls, then the others from the start. All of them once
  // opened, or before they are measured.
  const lined = $derived.by(() => {
    const widths = chipWidths.slice(0, chips.length);
    const moreWidth = chipWidths[chips.length];
    // the line's width inside its ring room (p-1)
    const room = lineWidth - 2 * RING_ROOM;
    if (groupsOpen || room <= 0 || !measured || moreWidth === undefined) return chips;
    const all = widths.reduce((sum, width) => sum + width, 0) + GAP * (chips.length - 1);
    if (all <= room) return chips;
    const current = chips.findIndex((chip) => chip.id === group);
    const kept = current >= 0 ? [current] : [];
    let used = moreWidth + (current >= 0 ? GAP + widths[current]! : 0);
    for (const [index, width] of widths.entries()) {
      if (index === current) continue;
      if (used + GAP + width > room) break;
      used += GAP + width;
      kept.push(index);
    }
    return chips.filter((_, index) => kept.includes(index));
  });
  const tucked = $derived(chips.length - lined.length);

  async function open() {
    browsing = true;
    await tick();
    search?.focus();
  }

  async function close() {
    browsing = false;
    query = "";
    await tick();
    more?.focus();
  }
</script>

<div data-slot="icon-picker" class="relative flex flex-col gap-3" style:--swatch={color}>
  {#if browsing}
    <div class="flex items-center gap-2">
      <div class="relative min-w-0 flex-1">
        <SearchIcon
          aria-hidden="true"
          class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        />
        <!-- the list search's skin, as it searches a set rather than takes a value to save -->
        <Input
          bind:ref={search}
          bind:value={query}
          variant="kit"
          type="search"
          aria-label="Search icons"
          placeholder="Search {CATALOG.length} icons"
          autocomplete="off"
          spellcheck={false}
          class="pr-9 pl-8 [&::-webkit-search-cancel-button]:hidden"
          onkeydown={(event: KeyboardEvent) => {
            // Esc clears a search first, then closes the catalogue; it never closes the layer
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            if (query) query = "";
            else void close();
          }}
        />
        <!-- our own clear, the same in every browser (Firefox draws none) -->
        {#if query}
          <button
            type="button"
            data-slot="search-clear"
            aria-label="Clear search"
            title="Clear search"
            class="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md outline-none focus-visible:ring-2 pointer-coarse:size-9"
            onclick={() => {
              query = "";
              search?.focus();
            }}
          >
            <XIcon aria-hidden="true" class="size-3.5" />
          </button>
        {/if}
      </div>
      <!-- quiet, so the search leads the row and it doesn't read as the form's own submit -->
      <Button type="button" variant="ghost" onclick={close}>Done</Button>
    </div>

    <!-- the chips as they would sit, unseen and taking no room, to measure how many one line holds -->
    <div
      bind:this={ruler}
      aria-hidden="true"
      class="invisible absolute top-0 left-0 flex size-0 gap-1.5 overflow-hidden"
    >
      {#each chips as chip (chip.id)}<span class={CHIP}>{chip.label}</span>{/each}
      <span class={CHIP}>+{chips.length} more</span>
    </div>

    <div
      role="group"
      aria-label="Icon groups"
      bind:clientWidth={lineWidth}
      class={cn(
        // room for a chip's focus ring, which the clipped line would cut, taken back outside
        "-m-1 flex gap-1.5 p-1",
        groupsOpen || !measured ? "flex-wrap" : "flex-nowrap overflow-hidden"
      )}
    >
      {#each lined as chip (chip.id)}
        <button
          type="button"
          data-slot="icon-group"
          aria-pressed={!query.trim() && group === chip.id}
          class={CHIP}
          onclick={() => {
            category = chip.id;
            query = "";
          }}
        >
          {chip.label}
        </button>
      {/each}
      {#if groupsOpen || tucked > 0}
        <button
          type="button"
          data-slot="icon-group-more"
          aria-expanded={groupsOpen}
          class={cn(CHIP, "border-dashed")}
          onclick={() => (groupsOpen = !groupsOpen)}
        >
          {groupsOpen ? "Show less" : `+${tucked} more`}
        </button>
      {/if}
    </div>
  {/if}

  {#if shown.length || (kept && !browsing)}
    <!-- square tiles from the left, as the colour swatches sit -->
    <div
      bind:clientWidth={gridWidth}
      class="grid grid-cols-[repeat(auto-fill,2.25rem)] gap-2 pointer-coarse:grid-cols-[repeat(auto-fill,2.75rem)]"
    >
      {#if kept && !browsing}
        {@render option(kept, `Current icon (${kept})`, true)}
      {/if}
      {#each shown as icon (icon.name)}
        {@render option(icon.name, icon.label, selected === icon.name)}
      {/each}
      {#if !browsing}
        <!-- the rest of the catalogue, as the line's last tile: dashed, as "+N more" is -->
        <button
          bind:this={more}
          type="button"
          data-slot="icon-more"
          aria-label="More icons"
          title="More icons"
          class="border-border text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex size-9 items-center justify-center rounded-lg border border-dashed outline-none focus-visible:ring-2 pointer-coarse:size-11"
          onclick={open}
        >
          <LayoutGridIcon aria-hidden="true" class="size-4" />
        </button>
      {/if}
    </div>
  {:else}
    <p class="text-muted-foreground text-sm">
      No icons match “{query.trim()}”. Try a word such as money, people or truck.
    </p>
  {/if}

  <!-- how many a search or a group shows, said as it changes -->
  <p aria-live="polite" class="sr-only">
    {browsing ? `${listed.length} ${listed.length === 1 ? "icon" : "icons"}` : ""}
  </p>
</div>

{#snippet option(name: string, label: string, checked: boolean)}
  <!-- relative, so the hidden radio sits on its icon: focus scrolls to it, not to the card's top -->
  <label data-slot="icon-option" class="relative cursor-pointer" title={label}>
    <input
      type="radio"
      name="{id}-icon"
      value={name}
      {checked}
      onchange={() => onpick(name)}
      aria-label={label}
      class="peer sr-only"
    />
    <span
      class="border-border text-muted-foreground hover:bg-muted peer-focus-visible:ring-ring flex size-9 items-center justify-center rounded-lg border peer-checked:border-(--swatch) peer-checked:bg-[color-mix(in_oklab,var(--swatch)_14%,transparent)] peer-checked:text-(--swatch) peer-focus-visible:ring-2 dark:peer-checked:text-[color-mix(in_oklab,var(--swatch)_50%,white)] pointer-coarse:size-11"
    >
      <HeroIcon {name} class="size-4" />
    </span>
  </label>
{/snippet}
