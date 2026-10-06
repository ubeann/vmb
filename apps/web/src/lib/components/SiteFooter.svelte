<!--
  The footer strip of every page, signed in (AppShell) or out (AuthShell, the
  error page): the copyright, the support team's address and the developer
  credit. Callers set its spacing through `class`, e.g. AuthShell tightens it
  under the plate and AppShell aligns it to the panel's edge. The full text
  gives way to icon buttons by the strip's own width, not the viewport's, so
  an open sidebar beside it doesn't crowd it.
-->
<script lang="ts">
  import GitHubMark from "$lib/components/GitHubMark.svelte";
  import { cn } from "$lib/utils.js";
  import Mail from "@lucide/svelte/icons/mail";

  let { class: className }: { class?: string } = $props();

  const copyrightYear = new Date().getFullYear();

  const footerLinkClass =
    "text-foreground decoration-muted-foreground hover:decoration-foreground focus-visible:ring-ring inline-flex min-h-6 pointer-coarse:min-h-11 items-center rounded-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none";

  // Below 64rem of strip width the links shrink to 44px icon buttons; their names stay in the label.
  const footerIconClass =
    "text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none @5xl:hidden";
</script>

<!-- The wrapper is the container the strip is measured by: the footer itself pads its
     content box, which would shift the breakpoint. -->
<div class="@container">
  <footer class={cn("mx-auto w-full max-w-7xl px-6 pt-10 pb-4 sm:px-10 lg:px-16", className)}>
    <div class="text-muted-foreground flex items-center justify-between gap-x-3 text-xs sm:gap-x-6">
      <p class="sm:whitespace-nowrap">© {copyrightYear} PT. Vifiera Minova Bersaudara</p>
      <p class="flex shrink-0 flex-wrap items-center justify-center gap-x-1 gap-y-1 @5xl:gap-x-5">
        <a
          class={footerIconClass}
          href="mailto:support@vmblogistics.id"
          aria-label="Email the support team, support@vmblogistics.id"
        >
          <Mail class="size-5" aria-hidden="true" />
        </a>
        <a
          class={footerIconClass}
          href="https://github.com/ubeann"
          aria-label="Built by ubeann, on GitHub"
        >
          <GitHubMark class="size-5" />
        </a>
        <span class="hidden items-center gap-1.5 @5xl:inline-flex">
          <Mail class="size-3.5 shrink-0" aria-hidden="true" />
          Support team:
          <a class={footerLinkClass} href="mailto:support@vmblogistics.id"
            >support@vmblogistics.id</a
          >
        </span>
        <span class="hidden items-center gap-1.5 @5xl:inline-flex">
          <GitHubMark class="size-3.5 shrink-0" />
          Built by
          <a class={footerLinkClass} href="https://github.com/ubeann">ubeann</a>
        </span>
      </p>
    </div>
  </footer>
</div>
