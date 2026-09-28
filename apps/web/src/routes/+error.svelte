<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import PageMeta from "$lib/components/PageMeta.svelte";
  import VmbLogo from "$lib/components/VmbLogo.svelte";

  let title = $derived(page.status === 404 ? "Page not found" : "Something went wrong");
</script>

<PageMeta {title} description="This VMB page could not be loaded." />

<main class="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16 sm:py-24">
  <VmbLogo class="h-10 self-start" />
  <div>
    <p class="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase">
      Error {page.status}
    </p>
    <h1 class="font-display mt-2 text-4xl font-medium tracking-tight">{title}</h1>
    {#if page.status !== 404 && page.error?.message}
      <p class="text-muted-foreground mt-3">{page.error.message}</p>
    {/if}
  </div>
  <a
    href={resolve("/")}
    class="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center self-start rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >Back to VMB</a
  >
</main>
