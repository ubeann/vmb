<!--
  The branded error page: the signed-out masthead and footer, an engraved
  vignette picked by status (a lost road, a locked gate, toppled crates) and
  fixed copy with a way back. The text never waits on the art, which sits
  2.5rem clear of it and is hidden from assistive tech.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import EtchedVignette from "$lib/components/EtchedVignette.svelte";
  import PageMeta from "$lib/components/PageMeta.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { errorPageContent } from "$lib/error-page.js";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";

  let content = $derived(errorPageContent(page.status));
  let errorId = $derived(page.error?.errorId);

  const supportLinkClass =
    "text-foreground decoration-muted-foreground hover:decoration-foreground focus-visible:ring-ring rounded-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none";
</script>

<PageMeta title={content.title} description={content.body} />

<div class="relative isolate flex min-h-dvh flex-col overflow-x-clip">
  <SiteHeader />

  <main
    class="mx-auto grid w-full max-w-7xl flex-1 content-center items-center gap-10 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16 lg:px-16"
  >
    <EtchedVignette
      scene={content.scene}
      class="justify-self-center [--vignette-max-height:11rem] sm:[--vignette-max-height:15rem] lg:order-last lg:[--vignette-max-height:26rem]"
    />

    <div class="max-w-xl">
      <div role="alert">
        <p class="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase">
          Error {page.status}
        </p>
        <h1
          class="font-display mt-3 text-[2.5rem] leading-[1.05] font-normal tracking-tight text-balance sm:text-5xl lg:text-6xl"
        >
          {content.title}
        </h1>
        <p class="text-muted-foreground mt-4 max-w-md text-base text-pretty">{content.body}</p>
      </div>

      <div class="mt-8 flex flex-wrap items-center gap-3">
        {#if content.canRetry}
          <Button
            href={`${page.url.pathname}${page.url.search}`}
            data-sveltekit-reload
            class="min-h-11 px-4"
          >
            <RotateCw aria-hidden="true" />
            Try again
          </Button>
        {/if}
        <Button
          href={page.data.user ? resolve("/") : resolve("/login")}
          variant={content.canRetry ? "outline" : "default"}
          class="min-h-11 px-4"
        >
          <ArrowLeft aria-hidden="true" />
          {page.data.user ? "Back to VMB" : "Go to login"}
        </Button>
      </div>

      {#if errorId}
        <p class="text-muted-foreground mt-8 max-w-md text-sm text-pretty">
          If this keeps happening, email
          <a
            class={supportLinkClass}
            href={`mailto:support@vmblogistics.id?subject=${encodeURIComponent(`VMB error ${errorId}`)}`}
            >support@vmblogistics.id</a
          >
          with reference <code class="text-foreground font-mono">{errorId}</code>.
        </p>
      {/if}
    </div>
  </main>

  <SiteFooter />
</div>
