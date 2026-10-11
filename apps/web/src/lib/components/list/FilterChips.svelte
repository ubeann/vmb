<script lang="ts" module>
  /** A filter a list offers: one URL parameter, and the values it may take. */
  export type ListFilter = {
    key: string;
    label: string;
    options: readonly { value: string; label: string }[];
  };

  /** The filters the URL has set to a value the list offers, with that value's label. */
  export function activeFilters(filters: readonly ListFilter[], params: URLSearchParams) {
    return filters.flatMap((filter) => {
      const option = filter.options.find(({ value }) => value === params.get(filter.key));
      return option ? [{ filter, option }] : [];
    });
  }
</script>

<!--
  The list's filters as removable chips, one per URL parameter, and a
  "+ Add filter" menu for the rest (#301). Every chip and menu entry is a link
  to the list with that parameter changed, so the browser's history, a copied
  URL and the no-JavaScript list all agree.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { buttonVariants } from "$lib/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { listHref, type MasterListPathname } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";

  let {
    base,
    filters,
    class: className = ""
  }: { base: MasterListPathname; filters: readonly ListFilter[]; class?: string } = $props();

  const active = $derived(activeFilters(filters, page.url.searchParams));
  const available = $derived(
    filters.filter((filter) => !active.some((chip) => chip.filter.key === filter.key))
  );
</script>

<ul class={cn("flex flex-wrap items-center gap-2", className)} aria-label="Filters">
  {#each active as { filter, option } (filter.key)}
    <li
      class="border-border bg-secondary text-secondary-foreground inline-flex h-8 items-center gap-1 rounded-(--control-radius) border pr-1 pl-3 text-sm pointer-coarse:h-11 pointer-coarse:pr-0"
    >
      <span><span class="text-muted-foreground">{filter.label}:</span> {option.label}</span>
      <!-- its corner nests inside the chip's: 4px in from the edge on a mouse, flush inside the 1px border on touch -->
      <a
        href={resolve(listHref(base, page.url.searchParams, { [filter.key]: null }))}
        data-sveltekit-noscroll
        aria-label="Remove filter {filter.label}: {option.label}"
        class="hover:bg-accent focus-visible:ring-ring inline-flex size-6 items-center justify-center rounded-[calc(var(--control-radius)-0.25rem)] focus-visible:ring-2 focus-visible:outline-none pointer-coarse:size-11 pointer-coarse:rounded-[calc(var(--control-radius)-1px)]"
      >
        <XIcon aria-hidden="true" class="size-3.5" />
      </a>
    </li>
  {/each}

  {#if available.length > 0}
    <li>
      <DropdownMenu.Root>
        <!-- the button slot gives it the 44px touch target and the full focus ring -->
        <DropdownMenu.Trigger
          data-slot="button"
          class={cn(buttonVariants({ variant: "outline" }), "border-dashed")}
        >
          <PlusIcon aria-hidden="true" data-icon="inline-start" />Add filter
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" class="w-52">
          {#each available as filter, index (filter.key)}
            {#if index > 0}<DropdownMenu.Separator />{/if}
            <DropdownMenu.Group>
              <DropdownMenu.GroupHeading>{filter.label}</DropdownMenu.GroupHeading>
              {#each filter.options as option (option.value)}
                <DropdownMenu.Item>
                  {#snippet child({ props })}
                    <a
                      {...props}
                      href={resolve(
                        listHref(base, page.url.searchParams, { [filter.key]: option.value })
                      )}
                      data-sveltekit-noscroll>{option.label}</a
                    >
                  {/snippet}
                </DropdownMenu.Item>
              {/each}
            </DropdownMenu.Group>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </li>
  {/if}
</ul>
