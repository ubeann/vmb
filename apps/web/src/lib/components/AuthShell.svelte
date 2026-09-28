<!--
  Frame for the signed-out pages (login, activate): the VMB masthead and brand
  line on paper, the page's form on a ruled sheet, and the engraved panorama
  along the foot of the viewport. The sheet stays usable before, during and
  without the artwork.
-->
<script lang="ts">
  import EtchedScene from "$lib/components/EtchedScene.svelte";
  import EtchedSky from "$lib/components/EtchedSky.svelte";
  import VmbLogo from "$lib/components/VmbLogo.svelte";
  import type { Snippet } from "svelte";

  let {
    heading,
    description,
    children,
    footer
  }: {
    heading: string;
    description?: Snippet;
    children: Snippet;
    footer?: Snippet;
  } = $props();
</script>

<div class="relative isolate flex min-h-dvh flex-col overflow-x-clip">
  <EtchedSky class="absolute inset-x-0 top-0 -z-10 hidden h-[clamp(16rem,55vh,36rem)] lg:block" />

  <header
    class="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 pt-6 sm:px-10 lg:px-16 lg:pt-10"
  >
    <VmbLogo class="h-10 sm:h-11" />
    <p class="text-muted-foreground hidden text-xs font-medium tracking-[0.2em] uppercase sm:block">
      Warehouse · Trucking · Expense
    </p>
  </header>

  <main
    class="relative z-10 mx-auto grid w-full max-w-7xl flex-1 content-start gap-8 px-6 pt-8 pb-6 sm:px-10 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-16 lg:px-16 lg:pt-16"
  >
    <div class="max-w-xl lg:pt-4">
      <p
        class="font-display text-[2rem] leading-[1.05] font-normal tracking-tight text-balance sm:text-5xl lg:text-6xl"
      >
        Every crate, container and receipt, on record.
      </p>
      <p class="text-muted-foreground mt-4 hidden max-w-md text-base text-pretty sm:block lg:mt-6">
        Warehouse items, trucking orders and division expenses, kept in one place for the people who
        run them.
      </p>
    </div>

    <div class="relative w-full lg:justify-self-end">
      <section
        aria-labelledby="auth-heading"
        class="bg-card text-card-foreground w-full rounded-md border p-6 shadow-[0_0_0_5px_var(--card),0_0_0_6px_var(--border),0_24px_48px_-32px_color-mix(in_oklch,var(--etching)_40%,transparent)] sm:p-8"
      >
        <h1 id="auth-heading" class="font-display text-3xl font-medium tracking-tight">
          {heading}
        </h1>
        {#if description}
          <p class="text-muted-foreground mt-2 text-sm text-pretty">{@render description()}</p>
        {/if}

        <div class="mt-6">{@render children()}</div>

        {#if footer}
          <div class="border-border text-muted-foreground mt-6 border-t pt-4 text-sm">
            {@render footer()}
          </div>
        {/if}
      </section>
    </div>
  </main>

  <EtchedScene class="-mt-6 lg:absolute lg:inset-x-0 lg:bottom-0 lg:mt-0" />
</div>
