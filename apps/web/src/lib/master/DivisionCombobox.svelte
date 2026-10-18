<!--
  The Division a Role operates in, chosen from a searchable list (#463): "Every
  division" is the empty choice, for a role that works across divisions. The
  choice posts as a hidden `divisionId` field, empty for every Division. A
  Division of a role that went Inactive is offered only to that role, marked as
  such (the Inactive rule). Without JavaScript a plain select takes its place,
  so the form still saves.
-->
<script lang="ts">
  import Marked from "$lib/components/list/Marked.svelte";
  import { cn } from "$lib/utils.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import { Combobox } from "bits-ui";
  import { onMount } from "svelte";
  import type { DivisionChoice } from "./loads.js";

  let {
    id,
    divisions,
    value = $bindable(null),
    name = "divisionId",
    invalid = false,
    describedby
  }: {
    /** On the text field, so the form's label points at it. */
    id: string;
    /** What can be chosen, and the role's current Division. */
    divisions: DivisionChoice[];
    /** The id chosen; null, or undefined as an untouched form has it, is every Division. */
    value?: string | null;
    name?: string;
    invalid?: boolean;
    describedby?: string;
  } = $props();

  const EVERY = "Every division";
  // a value no Division can have, for the empty choice
  const NONE = "none";

  let ready = $state(false);
  onMount(() => (ready = true));

  let search = $state("");
  let open = $state(false);
  const listId = $derived(`${id}-options`);

  const label = (division: DivisionChoice) =>
    division.inactive ? `${division.name} (inactive)` : division.name;

  const options = $derived([
    { value: NONE, label: EVERY },
    ...divisions.map((division) => ({ value: division.id, label: label(division) }))
  ]);
  const shown = $derived.by(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => option.label.toLowerCase().includes(term));
  });
  const chosen = $derived(options.find((option) => option.value === (value ?? NONE)));

  const FIELD =
    "border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex h-8 w-full items-center rounded-(--control-radius) border bg-transparent pr-1.5 pl-2.5 text-sm transition-colors focus-within:ring-3 pointer-coarse:h-11";
</script>

{#if ready}
  <input type="hidden" {name} value={value ?? ""} />

  <Combobox.Root
    type="single"
    value={value ?? NONE}
    onValueChange={(next) => {
      value = next === NONE ? null : next;
      search = "";
    }}
    bind:open
    inputValue={search}
    items={options}
    onOpenChange={(next) => {
      if (!next) search = "";
    }}
  >
    <div class={cn(FIELD, invalid && "border-destructive ring-destructive/20 ring-3")}>
      <Combobox.Input
        {id}
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={describedby}
        aria-controls={open ? listId : undefined}
        autocomplete="off"
        defaultValue={chosen?.label ?? EVERY}
        onclick={() => (open = true)}
        oninput={(event) => (search = event.currentTarget.value)}
        class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent py-0.5 text-base outline-none md:text-sm"
      />
      <Combobox.Trigger
        aria-label="Show the divisions"
        class="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-6 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 pointer-coarse:size-8"
      >
        <ChevronsUpDownIcon aria-hidden="true" class="size-4" />
      </Combobox.Trigger>
    </div>

    <Combobox.Portal>
      <Combobox.Content
        id={listId}
        aria-label="Divisions"
        sideOffset={4}
        data-slot="division-options"
        class="bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 ring-foreground/10 z-50 max-h-[min(16rem,var(--bits-combobox-content-available-height))] w-(--bits-combobox-anchor-width) min-w-48 overflow-y-auto rounded-lg p-1 shadow-md ring-1 duration-100"
      >
        {#each shown as option (option.value)}
          <Combobox.Item
            value={option.value}
            label={option.label}
            class="data-highlighted:bg-accent data-highlighted:text-accent-foreground flex min-h-8 w-full cursor-default items-center gap-2 rounded-md py-1 pr-2 pl-2 text-sm outline-hidden select-none pointer-coarse:min-h-11"
          >
            {#snippet children({ selected })}
              <CheckIcon
                aria-hidden="true"
                class={cn("text-primary size-4 shrink-0", !selected && "invisible")}
              />
              <span class="min-w-0 flex-1 truncate font-medium"
                ><Marked text={option.label} term={search} /></span
              >
            {/snippet}
          </Combobox.Item>
        {:else}
          <p class="text-muted-foreground px-2 py-2 text-sm">No division matches.</p>
        {/each}
      </Combobox.Content>
    </Combobox.Portal>
  </Combobox.Root>
{:else}
  <select
    {id}
    {name}
    aria-invalid={invalid ? "true" : undefined}
    aria-describedby={describedby}
    class={cn(FIELD, "w-full", invalid && "border-destructive ring-destructive/20 ring-3")}
  >
    <option value="" selected={!value}>{EVERY}</option>
    {#each divisions as division (division.id)}
      <option value={division.id} selected={division.id === value}>{label(division)}</option>
    {/each}
  </select>
{/if}
