<!--
  The roles a User holds, chosen from a searchable list (#304): the chosen ones
  sit as removable chips in the field, and typing narrows the list under it. A
  role scoped to a Division says so beside its name, and one of an Inactive
  Division is offered only to the user who already holds it, marked as such
  (the Inactive rule). A role the caller does not fully hold (`grantable`, from the
  API) is listed disabled with a hint, since giving it or taking it away is
  refused with 403 `PERMISSION_ESCALATION`: a user who already holds one keeps it,
  as a chip with no remove button. The chosen ids post as hidden `roleIds` fields,
  so the form works as a plain form post.
-->
<script lang="ts">
  import Marked from "$lib/components/list/Marked.svelte";
  import { cn } from "$lib/utils.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import LockIcon from "@lucide/svelte/icons/lock";
  import XIcon from "@lucide/svelte/icons/x";
  import { Combobox } from "bits-ui";
  import type { RoleOption } from "./loads.js";

  let {
    id,
    roles,
    value = $bindable(),
    name = "roleIds",
    invalid = false,
    describedby
  }: {
    /** On the text field, so the form's label points at it. */
    id: string;
    /** What can be chosen, and every role already held. */
    roles: RoleOption[];
    /** The ids chosen; undefined, as an untouched form has it, is none. */
    value?: string[];
    name?: string;
    invalid?: boolean;
    describedby?: string;
  } = $props();

  const UNGRANTABLE = "You don't hold every permission this role grants";

  let search = $state("");
  let open = $state(false);
  let box = $state<HTMLElement | null>(null);
  let input = $state<HTMLElement | null>(null);

  const picked = $derived(value ?? []);
  const byId = $derived(new Map(roles.map((role) => [role.id, role])));
  const chosen = $derived(
    picked.flatMap((roleId) => {
      const role = byId.get(roleId);
      return role ? [role] : [];
    })
  );
  const shown = $derived.by(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roles;
    return roles.filter(
      (role) =>
        role.name.toLowerCase().includes(term) ||
        (role.divisionName ?? "").toLowerCase().includes(term)
    );
  });

  // the roles held that the caller may not take away: whatever the list does, they stay
  const locked = $derived(chosen.filter((role) => !role.grantable).map((role) => role.id));
  const keepLocked = (ids: string[]) => [...ids, ...locked.filter((id) => !ids.includes(id))];

  function remove(roleId: string) {
    value = picked.filter((each) => each !== roleId);
    input?.focus();
  }

  function onkeydown(event: KeyboardEvent) {
    // Backspace in an empty field takes the last chip back, as a tag field does, unless it is locked
    const last = picked.at(-1);
    if (
      event.key === "Backspace" &&
      search === "" &&
      last !== undefined &&
      !locked.includes(last)
    ) {
      value = picked.slice(0, -1);
    }
  }
</script>

{#each picked as roleId (roleId)}
  <input type="hidden" {name} value={roleId} />
{/each}

<Combobox.Root
  type="multiple"
  value={picked}
  onValueChange={(next) => {
    value = keepLocked(next);
    search = "";
  }}
  bind:open
  inputValue={search}
  items={roles.map((role) => ({ value: role.id, label: role.name }))}
  onOpenChange={(next) => {
    if (!next) search = "";
  }}
>
  <!-- the box is the field: clicking anywhere in it types, and the list opens under all of it; the input inside is the control, so the box needs no key handler of its own -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    bind:this={box}
    data-slot="role-combobox"
    onclick={(event) => {
      if (event.target !== event.currentTarget) return;
      input?.focus();
      open = true;
    }}
    class={cn(
      "border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex min-h-8 w-full cursor-text flex-wrap items-center gap-1.5 rounded-(--control-radius) border bg-transparent py-1 pr-1.5 pl-1.5 text-sm transition-colors focus-within:ring-3 pointer-coarse:min-h-11",
      invalid && "border-destructive ring-destructive/20 ring-3"
    )}
  >
    {#each chosen as role (role.id)}
      <span
        data-slot="role-chip"
        title={role.grantable ? undefined : UNGRANTABLE}
        class={cn(
          "bg-muted text-foreground inline-flex h-6 max-w-full items-center gap-1 rounded-md pl-2 text-sm font-medium pointer-coarse:h-8",
          role.grantable ? "pr-0.5" : "pr-2"
        )}
      >
        <span class="truncate"
          >{role.name}{#if !role.grantable}<span class="sr-only">, which you can't remove</span
            >{/if}</span
        >
        {#if role.grantable}
          <button
            type="button"
            aria-label="Remove the role {role.name}"
            class="text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-ring inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] outline-none focus-visible:ring-2 pointer-coarse:size-7"
            onclick={() => remove(role.id)}
          >
            <XIcon aria-hidden="true" class="size-3.5" />
          </button>
        {:else}
          <LockIcon aria-hidden="true" class="text-muted-foreground size-3.5 shrink-0" />
        {/if}
      </span>
    {/each}
    <Combobox.Input
      bind:ref={input}
      {id}
      aria-invalid={invalid ? "true" : undefined}
      aria-describedby={describedby}
      placeholder={chosen.length > 0 ? "" : "Search roles"}
      autocomplete="off"
      onclick={() => (open = true)}
      oninput={(event) => (search = event.currentTarget.value)}
      {onkeydown}
      class="placeholder:text-muted-foreground min-w-24 flex-1 bg-transparent px-1 py-0.5 text-base outline-none md:text-sm"
    />
    <Combobox.Trigger
      aria-label="Show the roles"
      class="text-muted-foreground hover:text-foreground focus-visible:ring-ring ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 pointer-coarse:size-8"
    >
      <ChevronsUpDownIcon aria-hidden="true" class="size-4" />
    </Combobox.Trigger>
  </div>

  <Combobox.Portal>
    <Combobox.Content
      customAnchor={box}
      sideOffset={4}
      data-slot="role-options"
      class="bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 ring-foreground/10 z-50 max-h-(--bits-combobox-content-available-height) w-(--bits-combobox-anchor-width) min-w-48 overflow-hidden rounded-lg p-1 shadow-md ring-1 duration-100"
    >
      <Combobox.Viewport class="max-h-64 overflow-y-auto">
        {#each shown as role (role.id)}
          <Combobox.Item
            value={role.id}
            label={role.name}
            disabled={!role.grantable}
            aria-disabled={role.grantable ? undefined : "true"}
            class="data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:text-muted-foreground flex min-h-8 w-full cursor-default items-center gap-2 rounded-md py-1 pr-2 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none pointer-coarse:min-h-11"
          >
            {#snippet children({ selected })}
              <CheckIcon
                aria-hidden="true"
                class={cn("text-primary size-4 shrink-0", !selected && "invisible")}
              />
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate font-medium"><Marked text={role.name} term={search} /></span>
                {#if !role.grantable}
                  <span class="text-muted-foreground text-xs text-pretty">{UNGRANTABLE}</span>
                {/if}
              </span>
              {#if role.divisionName}
                <span class="text-muted-foreground shrink-0 text-xs"
                  >{role.divisionName}{role.divisionInactive ? " (inactive)" : ""}</span
                >
              {/if}
            {/snippet}
          </Combobox.Item>
        {:else}
          <p class="text-muted-foreground px-2 py-2 text-sm">
            {roles.length === 0 ? "No roles to choose from." : "No role matches."}
          </p>
        {/each}
      </Combobox.Viewport>
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>
