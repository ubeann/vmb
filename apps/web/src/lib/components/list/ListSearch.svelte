<!--
  The list's search box (#301, #363). A plain GET form first: Enter submits it and it
  works without JavaScript, carrying the list's other parameters as hidden
  fields. With JavaScript the list follows the typing, about 300ms after it
  stops, keeping focus and scroll; one search adds one history entry, not one
  per keystroke. `/` anywhere outside a field focuses the box.

  The placeholder names the fields the query matches, and `shortPlaceholder`
  takes over when the field would cut it off (ADR-0051 rule 3). The right-hand
  slot holds the `/` hint while the field is empty and unfocused, and our own ×
  once there is text; the browser's cancel button is hidden. While a search is
  on its way the magnifier turns into a spinner and the field is `aria-busy`.
  Esc clears the text, and leaves the field when there is none.
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { Input } from "$lib/components/ui/input/index.js";
  import { listHref, type MasterListPathname } from "$lib/master/list.js";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";
  import { onDestroy, untrack } from "svelte";

  let {
    base,
    label,
    placeholder = "Search…",
    shortPlaceholder,
    class: className = ""
  }: {
    base: MasterListPathname;
    label: string;
    /** Names the matched fields: "Search name, code or description". */
    placeholder?: string;
    /** Used instead of `placeholder` when the field is too narrow to show it whole. */
    shortPlaceholder?: string;
    class?: string;
  } = $props();

  const DEBOUNCE_MS = 300;

  const current = $derived(page.url.searchParams.get("search") ?? "");
  // the other parameters ride along when the form is submitted without JavaScript
  const carried = $derived(
    [...page.url.searchParams].filter(([key]) => key !== "search" && key !== "page")
  );

  let value = $state(untrack(() => current));
  let input = $state<HTMLInputElement | null>(null);
  let focused = $state(false);
  // from the first keystroke until the list has followed it
  let busy = $state(false);
  let formWidth = $state(0);
  // measured again once the web fonts are in: the fallback font is narrower
  let fontsReady = $state(false);
  let canvas: HTMLCanvasElement | undefined;
  let sent: string | null = null;
  let latest = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    document.fonts.ready.then(() => (fontsReady = true));
  });

  // The whole placeholder when it fits the field, in the field's own font (16px on phones,
  // 14px from md up), else the short one
  const shownPlaceholder = $derived.by(() => {
    if (!shortPlaceholder || !input || !formWidth || !fontsReady) return placeholder;
    const style = getComputedStyle(input);
    const context = (canvas ??= document.createElement("canvas")).getContext("2d");
    if (!context) return placeholder;
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const room = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return context.measureText(placeholder).width <= room ? placeholder : shortPlaceholder;
  });

  // Follow the URL when something else changes it (clearing the filters, the
  // back button), but not when it is only catching up with what was typed.
  $effect(() => {
    const next = current;
    if (next !== untrack(() => sent)) value = next;
    sent = null;
  });

  async function search(term: string) {
    const mine = ++latest;
    sent = term.trim();
    busy = true;
    // the first search from an unsearched list is a new entry; refining it replaces that entry
    const replaceState = page.url.searchParams.has("search");
    try {
      await goto(resolve(listHref(base, page.url.searchParams, { search: sent })), {
        keepFocus: true,
        noScroll: true,
        replaceState
      });
    } finally {
      // a later search is still on its way
      if (mine === latest) busy = false;
    }
  }

  function oninput() {
    clearTimeout(timer);
    // a search already on its way is out of date now, so it must not end the busy state
    latest++;
    busy = true;
    timer = setTimeout(() => search(value), DEBOUNCE_MS);
  }

  function onsubmit(event: SubmitEvent) {
    event.preventDefault();
    clearTimeout(timer);
    search(value);
  }

  function clear() {
    clearTimeout(timer);
    value = "";
    search("");
    input?.focus();
  }

  function onfieldkeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (value) clear();
    else input?.blur();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        "input, textarea, select, [contenteditable='true'], [role='dialog'], [role='menu']"
      )
    )
      return;
    event.preventDefault();
    input?.focus();
  }

  onDestroy(() => clearTimeout(timer));
</script>

<svelte:window {onkeydown} />

<form
  method="GET"
  role="search"
  class="relative {className}"
  {onsubmit}
  bind:clientWidth={formWidth}
>
  <!-- a hand-written URL can repeat a parameter, so the key can't be the name alone -->
  {#each carried as [key, carriedValue], index (`${index}:${key}`)}
    <input type="hidden" name={key} value={carriedValue} />
  {/each}
  {#if busy}
    <LoaderCircleIcon
      aria-hidden="true"
      class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin motion-reduce:animate-none"
    />
  {:else}
    <SearchIcon
      aria-hidden="true"
      class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
    />
  {/if}
  <Input
    bind:ref={input}
    bind:value
    type="search"
    name="search"
    aria-label={label}
    aria-keyshortcuts="/"
    aria-busy={busy}
    placeholder={shownPlaceholder}
    autocomplete="off"
    variant="kit"
    class="pr-9 pl-8 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none"
    {oninput}
    onkeydown={onfieldkeydown}
    onfocus={() => (focused = true)}
    onblur={() => (focused = false)}
  />
  {#if value}
    <button
      type="button"
      data-slot="search-clear"
      aria-label="Clear the search"
      class="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring absolute top-1/2 right-1 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-[calc(var(--control-radius)-0.25rem)] focus-visible:ring-2 focus-visible:outline-none pointer-coarse:right-0 pointer-coarse:size-11"
      onclick={clear}><XIcon aria-hidden="true" class="size-3.5" /></button
    >
  {:else if !focused}
    <kbd
      aria-hidden="true"
      class="text-muted-foreground border-border pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border px-1.5 font-mono text-[0.7rem] sm:block"
      >/</kbd
    >
  {/if}
</form>
