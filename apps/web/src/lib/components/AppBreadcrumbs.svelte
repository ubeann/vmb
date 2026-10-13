<!--
  The trail in the top bar (#349, ADR-0050 rule 5): the group as plain text (it has no
  page of its own), then links, then the current page, which is marked and not a link.
  Icons are decoration, since the label says it. The bar hides the whole trail below
  `md` (ADR-0050 rule 5), so nothing here is styled for a phone.
-->
<script lang="ts">
  import type { Crumb } from "$lib/breadcrumbs.js";
  import HeroIcon from "$lib/components/HeroIcon.svelte";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import { NAV_ICONS } from "$lib/nav-icons.js";

  let { trail }: { trail: Crumb[] } = $props();
</script>

{#snippet label(crumb: Crumb)}
  {#if crumb.icon}
    {@const Icon = NAV_ICONS[crumb.icon]}
    <Icon class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
  {:else if crumb.tile}
    <span
      class="flex size-6 shrink-0 items-center justify-center rounded-md text-white"
      style:background-color={crumb.tile.colorHex}
    >
      <HeroIcon name={crumb.tile.iconName} class="size-4" />
    </span>
  {/if}
  <span class="truncate">{crumb.label}</span>
{/snippet}

<Breadcrumb.Root aria-label="Breadcrumb" class="min-w-0">
  <Breadcrumb.List class="flex-nowrap gap-1.5 sm:gap-2">
    {#each trail as crumb, index (index)}
      {#if index > 0}
        <Breadcrumb.Separator />
      {/if}
      <Breadcrumb.Item class="min-w-0 gap-1.5">
        {#if crumb.current}
          <Breadcrumb.Page
            role={undefined}
            aria-disabled={undefined}
            class="flex min-w-0 items-center gap-1.5"
          >
            {@render label(crumb)}
          </Breadcrumb.Page>
        {:else if crumb.href}
          <Breadcrumb.Link href={crumb.href} class="flex min-w-0 items-center gap-1.5">
            {@render label(crumb)}
          </Breadcrumb.Link>
        {:else}
          <span class="flex min-w-0 items-center gap-1.5">{@render label(crumb)}</span>
        {/if}
      </Breadcrumb.Item>
    {/each}
  </Breadcrumb.List>
</Breadcrumb.Root>
