<!--
  The app's one shortcut sheet (ADR-0052). `?` opens it on any signed-in page, except while
  typing in a field or with a dialog or menu open; the sidebar's "Shortcuts" row opens it
  too. "Everywhere" comes first, then the sections the current page registered. It opens
  on its title, without a focus ring on the close button.
-->
<script lang="ts">
  import KeyCap from "$lib/components/KeyCap.svelte";
  import { shouldIgnore } from "$lib/components/key-guard.js";
  import { shortcuts, type ShortcutSection } from "$lib/components/shortcuts.svelte.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import GlobeIcon from "@lucide/svelte/icons/globe";

  let title = $state<HTMLElement | null>(null);

  const mac = $derived(
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
  );
  const everywhere = $derived<ShortcutSection>({
    title: "Everywhere",
    icon: GlobeIcon,
    rows: [
      { keys: ["?"], what: "Show keyboard shortcuts" },
      { keys: [mac ? "⌘" : "Ctrl", "B"], what: "Collapse or expand the sidebar" }
    ]
  });
  const sections = $derived([everywhere, ...shortcuts.page]);

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "?" || shouldIgnore(event)) return;
    event.preventDefault();
    shortcuts.open = true;
  }
</script>

<svelte:window {onkeydown} />

<Dialog.Root bind:open={shortcuts.open}>
  <Dialog.Content
    class="max-h-[85svh] gap-0 overflow-y-auto p-0 sm:max-w-lg"
    onOpenAutoFocus={(event: Event) => {
      event.preventDefault();
      title?.focus();
    }}
  >
    <Dialog.Header class="border-border border-b px-6 py-4">
      <Dialog.Title bind:ref={title} tabindex={-1} class="outline-none"
        >Keyboard shortcuts</Dialog.Title
      >
      <Dialog.Description class="sr-only"
        >Every shortcut on this page, and the ones that work everywhere.</Dialog.Description
      >
    </Dialog.Header>
    {#each sections as section, index (index)}
      <section aria-labelledby="shortcuts-section-{index}" class="px-6 pt-5 pb-2">
        <h3
          id="shortcuts-section-{index}"
          class="text-muted-foreground mb-1 flex items-center gap-2 text-sm"
        >
          <span class="bg-muted inline-flex size-6 items-center justify-center rounded-md">
            <section.icon aria-hidden="true" class="size-3.5" />
          </span>
          {section.title}
        </h3>
        <dl class="divide-border divide-y">
          {#each section.rows as row (row.what)}
            <div class="flex min-h-12 items-center justify-between gap-4 py-2">
              <dt class="text-sm font-normal">{row.what}</dt>
              <dd class="flex shrink-0 items-center gap-1.5">
                {#each row.keys as key (key)}<KeyCap {key} />{/each}
                {#if row.alt}
                  <span class="text-muted-foreground px-0.5 text-xs">or</span>
                  {#each row.alt as key (key)}<KeyCap {key} />{/each}
                {/if}
              </dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
    <div class="h-4"></div>
  </Dialog.Content>
</Dialog.Root>
