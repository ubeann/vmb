<!--
  A record's icon on its tint (ADR-0051 rule 7): its colour at about 14% behind
  the glyph in the colour itself. In the dark theme the tint deepens and the
  glyph lightens so both stay readable on the card.
-->
<script lang="ts">
  import HeroIcon from "$lib/components/HeroIcon.svelte";
  import { cn } from "$lib/utils.js";

  let {
    iconName,
    colorHex,
    light = false,
    class: className
  }: {
    iconName: string;
    colorHex: string;
    /** As the light theme draws it, whatever the theme: for a preview of how it reads there. */
    light?: boolean;
    class?: string;
  } = $props();
</script>

<span
  data-slot="record-tile"
  class={cn(
    "flex size-7 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--tile)_14%,transparent)] text-(--tile)",
    !light &&
      "dark:bg-[color-mix(in_oklab,var(--tile)_30%,transparent)] dark:text-[color-mix(in_oklab,var(--tile)_50%,white)]",
    className
  )}
  style:--tile={colorHex}
>
  <HeroIcon name={iconName} class="size-4" />
</span>
