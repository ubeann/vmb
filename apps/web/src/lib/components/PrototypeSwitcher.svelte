<!--
  PROTOTYPE (prototype/list-kit): the floating bar that flips a prototype route between its
  variants through `?variant=`. Arrow keys cycle too, outside fields. Dev builds only.
-->
<script lang="ts">
  // PROTOTYPE: every URL here goes through resolve() inside a helper the rule cannot follow
  /* eslint-disable svelte/no-navigation-without-resolve */
  import { dev } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  let { variants }: { variants: { key: string; name: string }[] } = $props();

  const current = $derived(
    Math.max(
      0,
      variants.findIndex(({ key }) => key === (page.url.searchParams.get("variant") ?? "A"))
    )
  );

  function go(step: number) {
    const next = variants[(current + step + variants.length) % variants.length];
    if (!next) return;
    const url = new URL(page.url);
    url.searchParams.set("variant", next.key);
    goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true'], [role='menu']")) return;
    go(event.key === "ArrowLeft" ? -1 : 1);
  }
</script>

<svelte:window {onkeydown} />

{#if dev}
  <div
    data-prototype-switcher
    class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black px-2 py-1.5 font-mono text-xs text-white shadow-lg ring-2 ring-fuchsia-500"
  >
    <button
      class="rounded-full bg-transparent p-1.5 text-white hover:bg-white/20"
      onclick={() => go(-1)}
      aria-label="Previous variant"
    >
      <ChevronLeftIcon class="size-4" />
    </button>
    <span class="min-w-56 text-center">
      {variants[current]?.key} · {variants[current]?.name}
    </span>
    <button
      class="rounded-full bg-transparent p-1.5 text-white hover:bg-white/20"
      onclick={() => go(1)}
      aria-label="Next variant"
    >
      <ChevronRightIcon class="size-4" />
    </button>
  </div>
{/if}
