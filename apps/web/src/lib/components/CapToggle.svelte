<!--
  TEMPORARY (#348): switches a page's width cap between 80, 90 and 96rem and off,
  through `?cap=`, so the owner can pick the cap by eye. Remove with its use on
  the Divisions list once the value is chosen.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { listHref } from "$lib/master/list.js";

  const current = $derived(page.url.searchParams.get("cap") ?? "90");
  const options = ["80", "90", "96", "off"];
</script>

<nav
  aria-label="Width cap (temporary)"
  class="text-muted-foreground flex items-center gap-2 text-xs"
>
  <span>Cap:</span>
  {#each options as cap (cap)}
    <a
      href={resolve(listHref("/master/divisions", page.url.searchParams, { cap }))}
      aria-current={current === cap ? "true" : undefined}
      data-sveltekit-noscroll
      class="aria-[current=true]:bg-muted aria-[current=true]:text-foreground rounded px-1.5 py-0.5 underline-offset-2 hover:underline aria-[current=true]:font-medium"
      >{cap === "off" ? "off" : `${cap}rem`}</a
    >
  {/each}
</nav>
