<!--
  A record over its list (#302): the kit's layer frame for a record's view,
  create and edit, opened from a row or New rather than from a button of its
  own. ADR-0053 rules 1, 5 and 7, with the 2026-10-14 amendment for forms:

  - under 480px it fills the screen, a header with the title and × above the
    content and its footer, which keeps clear of the safe-area insets and the
    on-screen keyboard (the frame follows the visual viewport);
  - from 480px it is rule 1's centred dialog, `rounded-2xl`, at most
    `min(85svh, 44rem)` tall, over the `--scrim` backdrop.

  Its ground is the page's background, and the content sits on a card
  (LayerCard) between the header and the footer.

  The frame changes by CSS alone, so a resize across 480px is no handover
  and closes nothing, nor glides between the two: the duration times the
  enter and exit animations, and `transition-none` keeps it off every other
  property. Focus starts on the title (rule 5) and goes back to `returnFocus`
  on close. Esc, ×, and a click outside all ask `onclose`,
  which decides whether the layer may close (a form's "Discard changes?").
-->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import DialogOverlay from "$lib/components/ui/dialog/dialog-overlay.svelte";
  import { cn } from "$lib/utils.js";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";
  import { Dialog } from "bits-ui";
  import { tick, type Snippet } from "svelte";

  let {
    open,
    label,
    title,
    tile,
    badge,
    subtitle,
    onclose,
    returnFocus,
    children
  }: {
    open: boolean;
    /** The layer's title as text, such as the record's name or "New division". */
    label: string;
    /** The title as shown, where it carries more than the text. */
    title?: Snippet;
    /** The record's tile, before the title: what the layer is about at a glance. */
    tile?: Snippet;
    /** A mark on the tile's corner for what the layer does to the record: edit it, or make a new one. */
    badge?: "edit" | "new";
    /** A muted line under the title, read as the dialog's description: the code, the status, unsaved edits. */
    subtitle?: Snippet;
    /** The user asked to close: Esc, ×, a click outside, or the content's Cancel. */
    onclose: () => void;
    /** What takes focus once the layer has closed: the row or button that opened it. */
    returnFocus?: () => HTMLElement | null | undefined;
    /** The content and its footer (LayerBody, LayerFooter). */
    children: Snippet;
  } = $props();

  let content = $state<HTMLElement | null>(null);

  // Under 480px the frame is the visual viewport, so the on-screen keyboard
  // shortens it and the footer stays above the keys instead of behind them
  let height = $state("100dvh");
  let top = $state("0px");
  $effect(() => {
    const viewport = window.visualViewport;
    if (!open || !viewport) return;
    const follow = () => {
      height = `${viewport.height}px`;
      top = `${viewport.offsetTop}px`;
    };
    follow();
    viewport.addEventListener("resize", follow);
    viewport.addEventListener("scroll", follow);
    return () => {
      viewport.removeEventListener("resize", follow);
      viewport.removeEventListener("scroll", follow);
    };
  });

  // Rule 5: the title takes focus, quietly; the first field is not rung
  async function focusTitle() {
    await tick();
    content?.querySelector<HTMLElement>("[data-layer-title]")?.focus();
  }
</script>

<!-- open follows the prop alone: a close the content turns down (Keep editing) leaves it open -->
<Dialog.Root bind:open={() => open, (next) => !next && onclose()}>
  <Dialog.Portal>
    <DialogOverlay />
    <Dialog.Content
      bind:ref={content}
      data-layer-frame="modal"
      data-record-layer=""
      style="--layer-height: {height}; --layer-top: {top}"
      class={cn(
        "bg-background text-foreground fixed inset-x-0 top-(--layer-top) z-50 flex h-(--layer-height) flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] text-sm outline-none",
        "data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-10 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-10 transition-none duration-(--duration-panel)",
        "min-[480px]:ring-foreground/10 min-[480px]:data-open:slide-in-from-bottom-4 min-[480px]:data-closed:slide-out-to-bottom-4 min-[480px]:top-1/2 min-[480px]:right-auto min-[480px]:left-1/2 min-[480px]:h-auto min-[480px]:max-h-[min(85svh,44rem)] min-[480px]:w-[calc(100%-2rem)] min-[480px]:max-w-lg min-[480px]:-translate-x-1/2 min-[480px]:-translate-y-1/2 min-[480px]:rounded-2xl min-[480px]:px-0 min-[480px]:shadow-lg min-[480px]:ring-1"
      )}
      onOpenAutoFocus={(event: Event) => {
        event.preventDefault();
        void focusTitle();
      }}
      onCloseAutoFocus={(event: Event) => {
        const target = returnFocus?.();
        if (!target?.isConnected) return;
        event.preventDefault();
        target.focus();
      }}
    >
      <!-- a div, not a header: a portalled <header> would count as a second banner landmark -->
      <!-- on the ground with the footer, around the content's card: no line needed under it -->
      <div data-slot="layer-header" class="shrink-0 pt-[env(safe-area-inset-top)] min-[480px]:pt-0">
        <div class="flex min-h-16 items-center gap-3 py-3 pr-2 pl-4">
          {#if tile}
            <div
              class="relative shrink-0 [&_[data-slot=record-tile]]:size-10 [&_[data-slot=record-tile]]:rounded-xl [&_[data-slot=record-tile]_svg]:size-5"
            >
              {@render tile()}
              {#if badge}
                {@const Mark = badge === "edit" ? PencilIcon : PlusIcon}
                <span
                  aria-hidden="true"
                  data-slot="layer-badge"
                  data-badge={badge}
                  class="bg-card text-foreground ring-background absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full shadow-sm ring-2"
                >
                  <Mark class="size-3" />
                </span>
              {/if}
            </div>
          {/if}
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <Dialog.Title
              tabindex={-1}
              data-layer-title=""
              class="flex min-w-0 items-center gap-2.5 text-base leading-tight font-semibold outline-none"
            >
              {#if title}{@render title()}{:else}<span class="truncate">{label}</span>{/if}
            </Dialog.Title>
            {#if subtitle}
              <Dialog.Description class="text-muted-foreground truncate text-xs">
                {@render subtitle()}
              </Dialog.Description>
            {/if}
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="text-muted-foreground size-11 shrink-0 rounded-(--touch-radius)"
            aria-label="Close"
            onclick={onclose}
          >
            <XIcon aria-hidden="true" class="size-5" />
          </Button>
        </div>
      </div>
      {@render children()}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
