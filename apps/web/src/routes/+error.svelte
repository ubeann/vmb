<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import PageMeta from "$lib/components/PageMeta.svelte";
  import { PAPER_CARD_CLASS } from "$lib/components/paper-card.js";
  import VmbLogo from "$lib/components/VmbLogo.svelte";

  // Fixed, status-specific copy — never `page.error.message`, which is
  // server/library text not meant for a visitor (issue #205).
  let copy = $derived(
    page.status === 404
      ? { title: "Page not found", body: "This page doesn't exist or has moved." }
      : {
          title: "Something went wrong",
          body: "Try refreshing the page, or come back in a few minutes."
        }
  );

  const linkClass =
    "text-primary focus-visible:ring-ring inline-flex min-h-11 items-center self-start rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none";
</script>

<PageMeta title={copy.title} description={copy.body} />

<main class="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6 py-16 sm:py-24">
  <VmbLogo class="h-10 self-start" />

  <div role="alert" class={PAPER_CARD_CLASS}>
    <p class="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase">
      Error {page.status}
    </p>
    <h1 class="font-display mt-2 text-3xl font-medium tracking-tight">{copy.title}</h1>
    <p class="text-muted-foreground mt-3 flex gap-2.5 text-sm">
      <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{copy.body}</span>
    </p>
  </div>

  {#if page.data.user}
    <a href={resolve("/")} class={linkClass}>Back to VMB</a>
  {:else}
    <a href={resolve("/login")} class={linkClass}>Go to login</a>
  {/if}
</main>
