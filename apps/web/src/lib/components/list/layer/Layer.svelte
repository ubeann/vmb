<script lang="ts" module>
  import type { LayerFrame } from "./layer.js";

  /** What a layer's content can see and do. */
  export type LayerApi = {
    /** "panel" by the button from 640px, "modal" (sheet or dialog) under it. */
    readonly frame: LayerFrame;
    /** The steps open inside the layer, outermost first; empty at the top level. */
    readonly path: readonly string[];
    /** The step whose picker is open beside the panel, so its row can show it is expanded; null when none is. */
    readonly beside: string | null;
    /** Opens a step: beside the panel where its picker fits, inside the layer where not. */
    open(step: string): void;
    /** Goes back one step. */
    back(): void;
    /** Goes back to the top level, closing a picker beside the panel. */
    top(): void;
    /** Closes the layer, as the user does: it forgets its steps (rule 7). */
    close(): void;
  };

  export type LayerTriggerProps = Record<string, unknown>;
</script>

<!--
  The list kit's layer (ADR-0053): the Filter and View panels sit in it; a
  record's view and form sit in RecordLayer, its modal frame without a panel.
  One content, three frames: a bottom sheet under 480px, a centred dialog
  from 480 to 639px, the panel by its button from 640px. Steps
  replace the content in a sheet or dialog, and open beside the panel where the
  picker fits. The layer follows the screen across 640px and the room line,
  keeping its step, once the window has stopped resizing; a closing (outside
  click, Esc, ×, the button) forgets the steps, a handover doesn't.
-->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import DialogOverlay from "$lib/components/ui/dialog/dialog-overlay.svelte";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { cn } from "$lib/utils.js";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import XIcon from "@lucide/svelte/icons/x";
  import { Dialog } from "bits-ui";
  import { tick, type Component, type Snippet } from "svelte";
  import { createAttachmentKey } from "svelte/attachments";
  import {
    BESIDE_OFFSET,
    SETTLE_MS,
    fitsBeside as roomBeside,
    frameNow,
    whenSteady
  } from "./layer.js";

  let {
    label,
    icon: Icon,
    stepTitle = () => label,
    pickerWidth = 560,
    inside = (step) => [step],
    onclose,
    trigger,
    headerAction,
    panelClass,
    children,
    step,
    beside
  }: {
    /** The top level's title, such as "Filters"; also the layer's accessible name. */
    label: string;
    /** The icon of the button that opens the layer. The sheet and dialog show it before the top level's title; a step and the panel have none. */
    icon?: Component<{ "aria-hidden"?: "true"; class?: string }>;
    /** A step's title, from its path; the last entry is the step shown. A layer without steps leaves it out. */
    stepTitle?: (path: readonly string[]) => string;
    /** The picker's width beside the panel, which decides whether it fits. */
    pickerWidth?: number;
    /** The steps a picker beside the panel becomes inside the layer, such as its calendar once days are picked. */
    inside?: (step: string) => string[];
    /** Called when the user closes the layer, so its content can let go of a draft. */
    onclose?: () => void;
    /** The layer's button; spread `props` on it. */
    trigger: Snippet<[{ props: LayerTriggerProps }]>;
    /** Sits by the title at the top level, such as Reset. */
    headerAction?: Snippet<[LayerApi]>;
    /** Sizes the panel frame, such as `w-64` for a layer with less to show than the default `w-80`. */
    panelClass?: string;
    /** The top level's content. */
    children: Snippet<[LayerApi]>;
    /** A step's content inside the layer; a layer without steps, such as View, leaves it out. */
    step?: Snippet<[readonly string[], LayerApi]>;
    /** A step's picker beside the panel. Without it, steps always open inside. */
    beside?: Snippet<[string, LayerApi]>;
  } = $props();

  // opened and closed only through show() and close(), which set up and forget its steps
  let open = $state(false);
  let frame = $state<LayerFrame>("panel");
  let path = $state<string[]>([]);
  // the step whose picker is open beside the panel
  let besideStep = $state<string | null>(null);
  // whether the panel's picker fits beside it, measured when it opens and as the window settles
  let fits = $state(false);
  // a modal frame opened by a handover shows once the page has settled (rule 6)
  let ready = $state(false);
  let button = $state<HTMLElement | null>(null);
  let panel = $state<HTMLElement | null>(null);
  let sheet = $state<HTMLElement | null>(null);

  const id = $props.id();
  const steps = $derived(Boolean(beside));
  // rule 3: 20rem where the picker fits beside the panel, 22rem from the start where steps open inside
  const wide = $derived(steps && !fits);

  function measure() {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    fits = steps && roomBeside(button?.getBoundingClientRect().right ?? 0, pickerWidth, rem);
  }

  const api: LayerApi = {
    get frame() {
      return frame;
    },
    get path() {
      return path;
    },
    get beside() {
      return besideStep;
    },
    open(next) {
      if (frame === "panel" && path.length === 0 && beside && fits) besideStep = next;
      else path = [...path, next];
    },
    back() {
      path = path.slice(0, -1);
    },
    top() {
      path = [];
      besideStep = null;
    },
    close
  };

  function show() {
    frame = frameNow();
    measure();
    ready = true;
    open = true;
  }

  /**
   * Opens the layer as its button does, on a step when given one: how a chip
   * opens the Filter panel at its filter. Open already, it goes to that step
   * from the top.
   */
  export function openAt(next?: string) {
    if (!open) show();
    else api.top();
    if (next) api.open(next);
  }

  // rule 7: what a closed layer forgets
  function close() {
    if (!open) return;
    open = false;
    path = [];
    besideStep = null;
    cancelSteady();
    onclose?.();
  }

  // Rule 6: a handover waits until the window has stopped resizing, so a drag
  // across a line hands over once and no modal layer locks the page mid-drag.
  let settling: ReturnType<typeof setTimeout> | undefined;
  let cancelSteady = () => {};
  $effect(() => {
    if (!open) return;
    const settle = () => {
      // a modal frame waiting to show waits for this resize too
      cancelSteady();
      clearTimeout(settling);
      settling = setTimeout(follow, SETTLE_MS);
    };
    addEventListener("resize", settle);
    return () => {
      clearTimeout(settling);
      removeEventListener("resize", settle);
    };
  });

  // A click that only closes the panel is only that. The panel hears an outside
  // press after the click has already run, so a row beneath it (`openRow` on
  // the list) opened its record as well. The press is caught on its way down,
  // and the click it ends in is swallowed, and the panel closed from here: on
  // touch bits-ui dismisses from that click, which this one would never let it
  // see. Only the panel needs it: the sheet and dialog have an overlay that
  // stops a tap reaching what lies beneath, and bits-ui closes them from it.
  // Another layer's button is let through, so Filter can hand over to View in
  // one click, and so is anything a layer's own control opened (a menu or
  // listbox). The swallow is dropped once the press is over (a cancelled touch
  // scroll, a drag released elsewhere), so a later keyboard click is not eaten.
  $effect(() => {
    if (!open) return;
    const owns = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest(
          "[data-layer-frame], [data-layer-picker], [data-layer-trigger], [role=menu], [role=listbox]"
        )
      );
    let disarm = () => {};
    const ondown = (event: PointerEvent) => {
      disarm();
      if (frame !== "panel" || event.button !== 0 || owns(event.target)) return;
      let dropping: ReturnType<typeof setTimeout> | undefined;
      const swallow = (click: Event) => {
        // Enter or Space on a button is a click with no pointer behind it
        if ((click as MouseEvent).detail === 0) return;
        disarm();
        click.stopImmediatePropagation();
        click.preventDefault();
        close();
      };
      // the click follows its press within the same gesture; one that has not come
      // shortly after the press ended is not coming
      const released = () => {
        clearTimeout(dropping);
        dropping = setTimeout(disarm, 100);
      };
      disarm = () => {
        clearTimeout(dropping);
        removeEventListener("click", swallow, true);
        removeEventListener("pointerup", released, true);
        removeEventListener("pointercancel", disarm, true);
        disarm = () => {};
      };
      addEventListener("click", swallow, true);
      addEventListener("pointerup", released, true);
      addEventListener("pointercancel", disarm, true);
    };
    addEventListener("pointerdown", ondown, true);
    // closing the layer ends this effect, but a swallow armed by the press that closed it must
    // still catch its click
    return () => removeEventListener("pointerdown", ondown, true);
  });

  function follow() {
    const next = frameNow();
    if (next === "modal" && frame === "panel") {
      // the picker beside the panel becomes the matching step in the sheet
      if (besideStep) path = inside(besideStep);
      besideStep = null;
      frame = "modal";
      ready = false;
    }
    if (next === "modal" && frame === "modal" && !ready) {
      // the panel's exit leaves its overflow on screen until it unmounts
      cancelSteady();
      cancelSteady = whenSteady(() => (ready = true), { ready: () => !panel?.isConnected });
      return;
    }
    if (next === "panel" && frame === "modal") {
      cancelSteady();
      frame = "panel";
      ready = true;
    }
    measure();
    if (frame !== "panel" || !beside) return;
    // rule 2, followed: a step inside the panel goes out beside it once there
    // is room, the picker beside it comes in once there is not
    if (fits && path.length) {
      besideStep = path[0]!;
      path = [];
    } else if (!fits && besideStep) {
      path = inside(besideStep);
      besideStep = null;
    }
  }

  // Rule 5: a step puts focus on its title, quietly
  async function focusTitle() {
    await tick();
    (frame === "panel" ? panel : sheet)?.querySelector<HTMLElement>("[data-layer-title]")?.focus();
  }
  $effect(() => {
    void path.length;
    void path.at(-1);
    if (open) void focusTitle();
  });

  // Rule 5: a picker opens on its selected day, or today; the calendar marks
  // that day as the one it focuses
  function focusPicker(event: Event) {
    event.preventDefault();
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          "[data-layer-picker] :is([data-layer-focus], [data-range-calendar-day][tabindex='0'])"
        )
        ?.focus()
    );
  }

  const triggerProps = $derived({
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    "data-layer-trigger": "",
    onclick: () => (open ? close() : show()),
    [createAttachmentKey()]: (node: HTMLElement) => {
      button = node;
    }
  });

  const title = $derived(path.length ? stepTitle(path) : label);
  const backTo = $derived(path.length > 1 ? stepTitle(path.slice(0, -1)) : label);
</script>

{@render trigger({ props: triggerProps })}

<!-- the panel, from 640px -->
<Popover.Root open={open && frame === "panel"} onOpenChange={(next) => !next && close()}>
  <Popover.Content
    bind:ref={panel}
    customAnchor={button}
    align="end"
    data-layer-frame="panel"
    aria-labelledby="{id}-panel-title"
    role="dialog"
    class={cn(
      "flex max-h-(--bits-floating-available-height) w-80 flex-col gap-0 overflow-hidden p-0",
      wide && "w-[22rem]",
      panelClass
    )}
    onOpenAutoFocus={(event: Event) => {
      event.preventDefault();
      void focusTitle();
    }}
    onInteractOutside={(event: PointerEvent) => {
      // the button toggles the layer itself
      if (button?.contains(event.target as Node)) event.preventDefault();
    }}
  >
    {@render body(false)}
  </Popover.Content>
</Popover.Root>

<!-- a step's picker, beside the panel where it fits -->
{#if beside}
  <Popover.Root
    open={open && frame === "panel" && besideStep !== null}
    onOpenChange={(next) => !next && (besideStep = null)}
  >
    <Popover.Content
      customAnchor={panel}
      side="left"
      align="start"
      sideOffset={BESIDE_OFFSET}
      data-layer-picker
      role="dialog"
      aria-label={besideStep ? stepTitle([besideStep]) : undefined}
      class="w-auto max-w-none flex-row gap-0 overflow-hidden p-0"
      onOpenAutoFocus={focusPicker}
      onInteractOutside={(event: PointerEvent) => {
        // Only the top layer hears an outside click, so the picker passes it
        // on: outside both closes both, on the panel closes the picker alone
        if (!panel?.contains(event.target as Node)) close();
      }}
    >
      {#if besideStep}{@render beside(besideStep, api)}{/if}
    </Popover.Content>
  </Popover.Root>
{/if}

<!-- the sheet under 480px, the dialog from 480 to 639px -->
<Dialog.Root open={open && frame === "modal" && ready} onOpenChange={(next) => !next && close()}>
  <Dialog.Portal>
    <DialogOverlay />
    <Dialog.Content
      bind:ref={sheet}
      data-layer-frame="modal"
      aria-labelledby="{id}-modal-title"
      class={cn(
        "bg-popover text-popover-foreground ring-foreground/10 fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85svh] w-full max-w-[26rem] flex-col rounded-t-xl text-sm shadow-lg ring-1 outline-none",
        "data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-10 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-10 duration-200",
        "min-[480px]:data-open:slide-in-from-bottom-4 min-[480px]:data-closed:slide-out-to-bottom-4 min-[480px]:top-1/2 min-[480px]:bottom-auto min-[480px]:max-h-[min(85svh,44rem)] min-[480px]:-translate-y-1/2 min-[480px]:rounded-2xl"
      )}
      onOpenAutoFocus={(event: Event) => {
        event.preventDefault();
        void focusTitle();
      }}
    >
      {@render body(true)}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<!-- each frame renders its own header, also while it animates out of a handover -->
{#snippet body(modal: boolean)}
  {@const titleId = `${id}-${modal ? "modal" : "panel"}-title`}
  <!-- a div, not a header: a portalled <header> would count as a second banner landmark -->
  <div
    class={cn(
      "border-border flex shrink-0 items-center gap-1 border-b",
      modal ? "h-14 px-2" : "h-11 px-2",
      !path.length && "pl-4"
    )}
  >
    {#if path.length}
      <Button
        variant="ghost"
        size="icon"
        data-layer-back
        class={cn("text-muted-foreground", modal && "size-11 rounded-(--touch-radius)")}
        aria-label="Back to {backTo}"
        onclick={api.back}
      >
        <ChevronLeftIcon aria-hidden="true" class={modal ? "size-5" : undefined} />
      </Button>
    {/if}
    {#if modal && Icon && !path.length}
      <Icon aria-hidden="true" class="text-muted-foreground mr-1.5 size-5 shrink-0" />
    {/if}
    {#if modal}
      <Dialog.Title
        id={titleId}
        tabindex={-1}
        data-layer-title=""
        class="min-w-0 flex-1 truncate text-base font-semibold outline-none">{title}</Dialog.Title
      >
    {:else}
      <h2
        id={titleId}
        tabindex="-1"
        data-layer-title=""
        class="min-w-0 flex-1 truncate text-sm font-semibold outline-none"
      >
        {title}
      </h2>
    {/if}
    {#if !path.length && headerAction}{@render headerAction(api)}{/if}
    {#if modal}
      <Dialog.Close>
        {#snippet child({ props })}
          <Button
            {...props}
            data-slot="button"
            variant="ghost"
            size="icon"
            class="text-muted-foreground size-11 rounded-(--touch-radius)"
            aria-label="Close"
          >
            <XIcon aria-hidden="true" class="size-5" />
          </Button>
        {/snippet}
      </Dialog.Close>
    {/if}
  </div>
  {#if path.length && step}
    {#key path.join("/")}{@render step(path, api)}{/key}
  {:else}
    {@render children(api)}
  {/if}
{/snippet}
