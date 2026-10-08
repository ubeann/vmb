<!--
  The list's search box (#301). A plain GET form first: Enter submits it and it
  works without JavaScript, carrying the list's other parameters as hidden
  fields. With JavaScript the list follows the typing, about 300ms after it
  stops, keeping focus and scroll; one search adds one history entry, not one
  per keystroke. `/` anywhere outside a field focuses the box.
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { Input } from "$lib/components/ui/input/index.js";
  import { listHref, type MasterListPathname } from "$lib/master/list.js";
  import SearchIcon from "@lucide/svelte/icons/search";
  import { onDestroy, untrack } from "svelte";

  let {
    base,
    label,
    placeholder = "Search…",
    class: className = ""
  }: { base: MasterListPathname; label: string; placeholder?: string; class?: string } = $props();

  const DEBOUNCE_MS = 300;

  const current = $derived(page.url.searchParams.get("search") ?? "");
  // the other parameters ride along when the form is submitted without JavaScript
  const carried = $derived(
    [...page.url.searchParams].filter(([key]) => key !== "search" && key !== "page")
  );

  let value = $state(untrack(() => current));
  let input = $state<HTMLInputElement | null>(null);
  let sent: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Follow the URL when something else changes it (clearing the filters, the
  // back button), but not when it is only catching up with what was typed.
  $effect(() => {
    const next = current;
    if (next !== untrack(() => sent)) value = next;
    sent = null;
  });

  function search(term: string) {
    sent = term.trim();
    // the first search from an unsearched list is a new entry; refining it replaces that entry
    const replaceState = page.url.searchParams.has("search");
    goto(resolve(listHref(base, page.url.searchParams, { search: sent })), {
      keepFocus: true,
      noScroll: true,
      replaceState
    });
  }

  function oninput() {
    clearTimeout(timer);
    timer = setTimeout(() => search(value), DEBOUNCE_MS);
  }

  function onsubmit(event: SubmitEvent) {
    event.preventDefault();
    clearTimeout(timer);
    search(value);
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
  <!-- a hand-written URL can repeat a parameter, so the key can't be the name alone -->
  {#each carried as [key, carriedValue], index (`${index}:${key}`)}
    <input type="hidden" name={key} value={carriedValue} />
  {/each}
  <SearchIcon
    aria-hidden="true"
    class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
  />
  <Input
    bind:ref={input}
    bind:value
    type="search"
    name="search"
    aria-label={label}
    aria-keyshortcuts="/"
    {placeholder}
    autocomplete="off"
    class="pr-8 pl-8"
    {oninput}
  />
  <kbd
    aria-hidden="true"
    class="text-muted-foreground border-border pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border px-1.5 font-mono text-[0.7rem] sm:block"
    >/</kbd
  >
</form>
