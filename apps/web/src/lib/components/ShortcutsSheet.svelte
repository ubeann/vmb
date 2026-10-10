<!--
  PROTOTYPE (prototype/list-kit): round 50's app-wide shortcut sheet. `?` opens it on any page
  (not while typing, nor over another dialog or menu). "Everywhere" comes first, then the current
  page's own sections, each a titled group with key caps on the right.
-->
<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import DeleteIcon from "@lucide/svelte/icons/delete";
  import GlobeIcon from "@lucide/svelte/icons/globe";
  import { shortcuts, type ShortcutSection } from "./shortcuts.svelte.js";

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
    if (!shortcuts.enabled || event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey)
      return;
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        "input, textarea, select, [contenteditable='true'], [role='dialog'], [role='menu']"
      )
    )
      return;
    event.preventDefault();
    shortcuts.open = true;
  }
</script>

<svelte:window {onkeydown} />

{#snippet cap(key: string)}
  <kbd
    class="bg-muted text-muted-foreground border-border inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 font-mono text-xs"
    >{#if key === "⌫"}<DeleteIcon aria-label="Backspace" class="size-3.5" />{:else}{key}{/if}</kbd
  >
{/snippet}

<Dialog.Root bind:open={shortcuts.open}>
  <Dialog.Content
    class="max-h-[85svh] gap-0 overflow-y-auto p-0 sm:max-w-lg"
    onOpenAutoFocus={(event: Event) => {
      // open on the title, quietly, rather than ringing the close button
      event.preventDefault();
      document.getElementById("shortcuts-title")?.focus();
    }}
  >
    <Dialog.Header class="border-border border-b px-6 py-4">
      <Dialog.Title id="shortcuts-title" tabindex={-1} class="outline-none"
        >Keyboard shortcuts</Dialog.Title
      >
      <Dialog.Description class="sr-only"
        >Every shortcut on this page, and the ones that work everywhere.</Dialog.Description
      >
    </Dialog.Header>
    {#each sections as section (section.title)}
      <section aria-labelledby="shortcuts-{section.title}" class="px-6 pt-5 pb-2">
        <h3
          id="shortcuts-{section.title}"
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
                {#each row.keys as key (key)}{@render cap(key)}{/each}
                {#if row.alt}
                  <span class="text-muted-foreground px-0.5 text-xs">or</span>
                  {#each row.alt as key (key)}{@render cap(key)}{/each}
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
