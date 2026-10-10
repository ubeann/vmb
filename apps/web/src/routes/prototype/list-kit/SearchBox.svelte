<!--
  PROTOTYPE (prototype/list-kit): round 14's search box, a copy of the kit's ListSearch with
  - one slot on the right: the "/" hint while empty and unfocused, our own × once there is text
    (the browser's blue cancel button is hidden)
  - a spinner in place of the magnifier while a search is on its way
  - Esc clears the text first, then leaves the field
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { Input } from "$lib/components/ui/input/index.js";
  import { listHref, type MasterListPathname } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";
  import { onDestroy, untrack } from "svelte";

  let {
    base,
    label,
    placeholder = "Search…",
    class: className = ""
  }: { base: MasterListPathname; label: string; placeholder?: string; class?: string } = $props();

  const DEBOUNCE_MS = 300;

  const current = $derived(page.url.searchParams.get("search") ?? "");
  const carried = $derived(
    [...page.url.searchParams].filter(([key]) => key !== "search" && key !== "page")
  );

  let value = $state(untrack(() => current));
  let input = $state<HTMLInputElement | null>(null);
  let focused = $state(false);
  let busy = $state(false);
  let sent: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const next = current;
    if (next !== untrack(() => sent)) value = next;
    sent = null;
  });

  async function search(term: string) {
    sent = term.trim();
    const replaceState = page.url.searchParams.has("search");
    busy = true;
    try {
      await goto(resolve(listHref(base, page.url.searchParams, { search: sent })), {
        keepFocus: true,
        noScroll: true,
        replaceState
      });
    } finally {
      busy = false;
    }
  }

  function oninput() {
    clearTimeout(timer);
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

  // Esc clears what was typed; with nothing typed it leaves the field
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

<form method="GET" role="search" class="relative {className}" {onsubmit}>
  {#each carried as [key, carriedValue], index (`${index}:${key}`)}
    <input type="hidden" name={key} value={carriedValue} />
  {/each}
  {#if busy}
    <LoaderCircleIcon
      aria-hidden="true"
      class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin"
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
    {placeholder}
    autocomplete="off"
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
      class={cn(
        "text-muted-foreground hover:text-foreground hover:bg-muted absolute top-1/2 right-1 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md pointer-coarse:size-9"
      )}
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
