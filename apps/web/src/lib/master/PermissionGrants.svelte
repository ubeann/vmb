<!--
  A Role's grants on its form (#462): one checkbox per catalogue key, grouped
  by resource with its label and description, a per-resource "All", and a
  search that narrows the groups. The rule is ADR-0045's amendment of
  2026-10-17: a caller may grant or revoke only a permission they hold, so a
  key outside `held` is shown disabled, with a hint. The API is the
  enforcement; this only spares a refused save.

  The chosen keys post as `permissionKeys` fields, so the form works as a
  plain form post. A key the search hides stays in the page, only hidden, so
  it still posts; a chosen key the caller cannot change posts from a hidden
  field, since a disabled checkbox sends nothing.
-->
<script lang="ts">
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { cn } from "$lib/utils.js";
  import { permissionGroups } from "@vmb/types";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";

  let {
    value = $bindable(),
    held,
    name = "permissionKeys",
    describedby
  }: {
    /** The keys chosen; undefined, as an untouched form may have it, is none. */
    value?: string[];
    /** The caller's own permissions: the only keys they may grant or revoke. */
    held: readonly string[];
    name?: string;
    describedby?: string;
  } = $props();

  const GROUPS = permissionGroups();
  const ALL_KEYS = GROUPS.flatMap((group) => group.permissions.map((option) => option.key));
  const TOTAL = ALL_KEYS.length;

  const id = $props.id();
  let query = $state("");

  const chosen = $derived(new Set(value ?? []));
  const mine = $derived(new Set(held));
  const withheld = $derived(ALL_KEYS.filter((key) => !mine.has(key)).length);

  /** Whether an option, or its group, matches the search: by label, description or key. */
  function matches(term: string, ...texts: string[]) {
    return texts.some((text) => text.toLowerCase().includes(term));
  }

  // the keys each group shows under the search; a group whose own name matches shows them all
  const shown = $derived.by(() => {
    const term = query.trim().toLowerCase();
    return new Map(
      GROUPS.map((group) => {
        if (!term || matches(term, group.label, group.description)) {
          return [group.resource, new Set(group.permissions.map((option) => option.key))];
        }
        const keys = group.permissions
          .filter((option) => matches(term, option.label, option.description, option.key))
          .map((option) => option.key);
        return [group.resource, new Set(keys)];
      })
    );
  });
  const nothingShown = $derived([...shown.values()].every((keys) => keys.size === 0));

  function set(keys: string[], on: boolean) {
    // in catalogue order, so the form's value does not depend on the clicking order
    value = ALL_KEYS.filter((key) => (keys.includes(key) ? on : chosen.has(key)));
  }

  /** A group's "All": every key in it the caller may change, on or off together. */
  function groupState(keys: string[]) {
    const changeable = keys.filter((key) => mine.has(key));
    const on = changeable.filter((key) => chosen.has(key)).length;
    return {
      changeable,
      checked: changeable.length > 0 && on === changeable.length,
      indeterminate: on > 0 && on < changeable.length
    };
  }
</script>

<div class="flex flex-col gap-3" data-slot="permission-grants">
  {#if withheld > 0}
    <p id="{id}-withheld" class="text-muted-foreground text-xs">
      You can grant or take away only the permissions you hold yourself. The {withheld === 1
        ? "one you don't hold is"
        : `${withheld} you don't hold are`} greyed out.
    </p>
  {/if}

  <div class="relative">
    <SearchIcon
      aria-hidden="true"
      class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
    />
    <Input
      bind:value={query}
      variant="kit"
      type="search"
      aria-label="Search permissions"
      aria-describedby={describedby}
      placeholder="Search {TOTAL} permissions"
      autocomplete="off"
      spellcheck={false}
      class="pr-9 pl-8 [&::-webkit-search-cancel-button]:hidden"
      onkeydown={(event: KeyboardEvent) => {
        // Enter here searches, it never saves the form; Esc clears the search, never closes the layer
        if (event.key === "Enter") event.preventDefault();
        if (event.key === "Escape" && query) {
          event.preventDefault();
          event.stopPropagation();
          query = "";
        }
      }}
    />
    {#if query}
      <button
        type="button"
        aria-label="Clear search"
        title="Clear search"
        class="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md outline-none focus-visible:ring-2 pointer-coarse:size-9"
        onclick={() => (query = "")}
      >
        <XIcon aria-hidden="true" class="size-3.5" />
      </button>
    {/if}
  </div>

  {#if nothingShown}
    <p role="status" class="text-muted-foreground text-sm">
      No permissions match “{query.trim()}”.
    </p>
  {/if}

  {#each GROUPS as group (group.resource)}
    {@const visible = shown.get(group.resource) ?? new Set()}
    {@const all = groupState(group.permissions.map((option) => option.key))}
    {@const count = group.permissions.filter((option) => chosen.has(option.key)).length}
    <fieldset
      hidden={visible.size === 0}
      aria-describedby="{id}-{group.resource}-about"
      class="border-border flex flex-col rounded-lg border"
    >
      <legend class="sr-only">{group.label}</legend>
      <div class="bg-muted/40 flex items-start gap-3 rounded-t-lg border-b px-3 py-2.5">
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="text-sm font-medium" aria-hidden="true">{group.label}</span>
          <span id="{id}-{group.resource}-about" class="text-muted-foreground text-xs"
            >{group.description}</span
          >
        </div>
        <label
          class={cn(
            "flex shrink-0 items-center gap-2 text-xs font-medium",
            all.changeable.length === 0 && "text-muted-foreground"
          )}
        >
          <span class="text-muted-foreground font-normal tabular-nums"
            >{count} of {group.permissions.length}</span
          >
          <Checkbox
            checked={all.checked}
            indeterminate={all.indeterminate}
            disabled={all.changeable.length === 0}
            aria-label="All {group.label} permissions"
            onCheckedChange={(on) => set(all.changeable, on)}
          />
          <span aria-hidden="true">All</span>
        </label>
      </div>
      <ul class="flex flex-col">
        {#each group.permissions as option (option.key)}
          {@const locked = !mine.has(option.key)}
          {@const on = chosen.has(option.key)}
          <li hidden={!visible.has(option.key)} class="border-border not-first:border-t">
            <label
              class={cn(
                "flex items-start gap-3 px-3 py-2.5 pointer-coarse:py-3",
                locked ? "cursor-not-allowed" : "hover:bg-muted/40 cursor-pointer"
              )}
            >
              <Checkbox
                class="mt-0.5"
                {name}
                value={option.key}
                checked={on}
                disabled={locked}
                aria-labelledby="{id}-{option.key}-label"
                aria-describedby="{id}-{option.key}-about"
                onCheckedChange={(next) => set([option.key], next)}
              />
              {#if locked && on}
                <!-- a disabled box sends nothing, so the grant it shows posts from here -->
                <input type="hidden" {name} value={option.key} />
              {/if}
              <span class="flex min-w-0 flex-col gap-0.5">
                <span
                  id="{id}-{option.key}-label"
                  class={cn("text-sm leading-tight", locked && "text-muted-foreground")}
                  >{option.label}</span
                >
                <span id="{id}-{option.key}-about" class="text-muted-foreground text-xs">
                  {option.description}
                  {#if locked}<span class="text-foreground/70 font-medium"
                      >You don't hold this one.</span
                    >{/if}
                </span>
              </span>
            </label>
          </li>
        {/each}
      </ul>
    </fieldset>
  {/each}
</div>
