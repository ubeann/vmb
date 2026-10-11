<!--
  The app's one shortcut sheet (ADR-0052). `?` opens it on any signed-in page, except while
  typing in a field or with another dialog or menu open, and `?` closes it again; the
  sidebar's "Shortcuts" row opens it too, which is the way in with single-key shortcuts
  off. "Everywhere" comes first, then the sections the current page registered. It opens
  on its title, without a focus ring on the close button. Its footer holds the switch
  for single-key shortcuts (WCAG 2.1.4): off, those rows stay listed, marked "Off".
-->
<script lang="ts">
  import KeyCap from "$lib/components/KeyCap.svelte";
  import { modified, shouldIgnore } from "$lib/components/key-guard.js";
  import { shortcuts, type ShortcutSection } from "$lib/components/shortcuts.svelte.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import GlobeIcon from "@lucide/svelte/icons/globe";

  let title = $state<HTMLElement | null>(null);

  const mac = $derived(
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
  );
  const everywhere = $derived<ShortcutSection>({
    title: "Everywhere",
    icon: GlobeIcon,
    rows: [
      { keys: ["?"], what: "Show or hide keyboard shortcuts", single: true },
      { keys: [mac ? "⌘" : "Ctrl", "B"], what: "Collapse or expand the sidebar" }
    ]
  });
  const sections = $derived([everywhere, ...shortcuts.page]);

  // the remembered switch is read in the browser only, so it can't differ from the server's page
  $effect(() => shortcuts.restore());

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "?" || !shortcuts.singleKey) return;
    // The sheet is a dialog, so the usual guard would refuse its own key. It holds no field,
    // so the key is its own whenever it is open.
    if (
      shortcuts.open
        ? event.defaultPrevented || event.isComposing || modified(event)
        : shouldIgnore(event)
    )
      return;
    event.preventDefault();
    shortcuts.open = !shortcuts.open;
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
                {#if row.single && !shortcuts.singleKey}
                  <span class="text-muted-foreground text-xs">Off</span>
                {:else}
                  {#each row.keys as key (key)}<KeyCap {key} />{/each}
                  {#if row.alt}
                    <span class="text-muted-foreground px-0.5 text-xs">or</span>
                    {#if row.altSingle && !shortcuts.singleKey}
                      <span class="text-muted-foreground text-xs">{row.alt.join(" ")} off</span>
                    {:else}
                      {#each row.alt as key (key)}<KeyCap {key} />{/each}
                    {/if}
                  {/if}
                {/if}
              </dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
    <footer class="border-border mt-4 flex flex-col gap-2 border-t px-6 py-4">
      <div class="flex min-h-6 items-center justify-between gap-4">
        <Label for="single-key-shortcuts" class="text-sm font-medium">Single-key shortcuts</Label>
        <Switch
          id="single-key-shortcuts"
          aria-describedby="single-key-shortcuts-note"
          checked={shortcuts.singleKey}
          onCheckedChange={(on) => shortcuts.setSingleKey(on)}
        />
      </div>
      <p id="single-key-shortcuts-note" class="text-muted-foreground text-sm">
        {#if shortcuts.singleKey}
          Turn this off if keys like ? and / fire by accident, for example with speech input.
        {:else}
          Single-key shortcuts are off. {mac ? "⌘" : "Ctrl"} B, the arrow keys, Enter and Esc still work.
          You can open this sheet from Shortcuts in the sidebar.
        {/if}
      </p>
    </footer>
  </Dialog.Content>
</Dialog.Root>
