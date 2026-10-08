<!--
  TEMPORARY (#348): switches a page's width cap between 80, 90 and 96rem and off,
  so the owner can pick it by eye. The choice lives in the URL's fragment
  (`#cap=80`), which a list's canonical-query redirect leaves alone and a
  screenshot script can open directly. Remove with its use on the Divisions
  list once the value is chosen.
-->
<script lang="ts">
  import { onMount } from "svelte";

  let { cap = $bindable("90") }: { cap?: string } = $props();

  const options = ["80", "90", "96", "off"];

  const read = () => {
    const value = new URLSearchParams(location.hash.slice(1)).get("cap");
    cap = value && options.includes(value) ? value : "90";
  };
  onMount(read);
</script>

<svelte:window onhashchange={read} />

<nav
  aria-label="Width cap (temporary)"
  class="text-muted-foreground flex items-center gap-2 text-xs"
>
  <span>Cap:</span>
  {#each options as option (option)}
    <a
      href="#cap={option}"
      aria-current={cap === option ? "true" : undefined}
      class="aria-[current=true]:bg-muted aria-[current=true]:text-foreground rounded px-1.5 py-0.5 underline-offset-2 hover:underline aria-[current=true]:font-medium"
      >{option === "off" ? "off" : `${option}rem`}</a
    >
  {/each}
</nav>
