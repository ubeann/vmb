<!--
  The Appearance section of a Division's or a Role's form (#302, #303): the
  colour, from the swatches or a custom one, and the icon. Both forms hold the
  same three fields, `name` (which the icon picker suggests from), `colorHex`
  and `iconName`, so one piece serves both.
-->
<script lang="ts" generics="T extends Record<string, unknown> & AppearanceValues">
  import ColorPicker from "$lib/components/form/ColorPicker.svelte";
  import { contrastWithWhite, darkerShade, HARD_TO_SEE_BELOW } from "$lib/components/form/color.js";
  import FormSection from "$lib/components/form/FormSection.svelte";
  import IconPicker from "$lib/components/form/IconPicker.svelte";
  import { iconLabel } from "$lib/components/hero-icons.js";
  import RecordTile from "$lib/components/list/RecordTile.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Form from "$lib/components/ui/form/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { cn } from "$lib/utils.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import type { Snippet } from "svelte";
  import type { Readable, Writable } from "svelte/store";
  import type { FormPath, SuperForm } from "sveltekit-superforms";
  import { pickedColor, PENDING_COLOR, SWATCHES, type AppearanceValues } from "./appearance.js";

  let {
    superform,
    preview
  }: {
    superform: SuperForm<T>;
    /** How the record will look in the lists, drawn from the colour as picked; none when a layer's header shows it. */
    preview?: Snippet<[string]>;
  } = $props();

  // svelte-ignore state_referenced_locally
  const { form, errors } = superform;
  // the fields this section edits, as the shared three; `T` only promises they exist
  const fields = form as unknown as Writable<AppearanceValues>;
  const fieldErrors = errors as unknown as Readable<
    Partial<Record<keyof AppearanceValues, string[]>>
  >;

  // the swatches and the preview show the typed colour once it is a whole one
  const picked = $derived(pickedColor($fields.colorHex));
  const swatch = $derived(SWATCHES.find((option) => option.hex === picked));
  // the custom picker opens under the swatches when asked for, and stays until closed
  let customOpen = $state(false);
  // a colour the checks refuse opens it, so its field and the error are in view
  const panelOpen = $derived(customOpen || Boolean($fieldErrors.colorHex));
  const pickerId = $props.id();
  // a hex as design tools copy it, without its # or in lower case, is taken as it was meant
  function hexTypedIn(typed: string) {
    const bare = typed.trim().replace(/^#/, "");
    $fields.colorHex = /^[0-9a-fA-F]{6}$/.test(bare) ? `#${bare.toUpperCase()}` : typed;
  }

  // `T` only promises these paths exist, which the form's own typing cannot see
  const COLOR = "colorHex" as unknown as FormPath<T>;
  const ICON = "iconName" as unknown as FormPath<T>;

  // hints sit close under their field, a step smaller than its label
  const HINT = "text-xs";
</script>

<FormSection title="Appearance" hint="How it shows in lists and menus.">
  <!-- how it will look in the lists, as it is chosen; in the layer its header shows it instead -->
  {#if preview}
    {@render preview(picked ?? PENDING_COLOR)}
  {/if}

  <Form.Fieldset form={superform} name={COLOR} class="space-y-2">
    <!-- the chosen colour's name beside the heading, as the icon's is; the radios say it to a screen reader -->
    <Form.Legend
      >Color <span aria-hidden="true" class="text-muted-foreground font-normal"
        >· {swatch?.label ?? (picked || $fields.colorHex || "None")}</span
      ></Form.Legend
    >
    <!-- with the picker closed, the colour as it stands: a custom one no swatch shows; a checked
         swatch, posted after it, wins -->
    {#if !panelOpen}
      <input type="hidden" name="colorHex" value={$fields.colorHex} />
    {/if}
    <!-- the swatches, then the custom one last, as the icons end in More: thirteen cells that
         make one line of the card's width, and on a phone two that keep their columns -->
    <div
      class="grid grid-cols-[repeat(auto-fill,2rem)] gap-0.5 pointer-coarse:grid-cols-[repeat(auto-fill,2.75rem)] pointer-coarse:gap-0"
    >
      {#each SWATCHES as option (option.hex)}
        <label
          data-slot="swatch"
          class="relative flex size-8 cursor-pointer items-center justify-center pointer-coarse:size-11"
          title={option.label}
        >
          <!-- posts the colour, after the hidden field below, so a swatch picked without JavaScript wins -->
          <input
            type="radio"
            name="colorHex"
            value={option.hex}
            checked={swatch === option}
            onchange={() => ($fields.colorHex = option.hex)}
            aria-label={option.label}
            class="peer sr-only"
          />
          <span
            class="ring-offset-popover peer-focus-visible:ring-ring flex size-6 items-center justify-center rounded-full text-white ring-offset-2 peer-checked:ring-2 peer-checked:ring-(--swatch) peer-focus-visible:ring-2"
            style:--swatch={option.hex}
            style:background={option.hex}
          >
            {#if swatch === option}<CheckIcon aria-hidden="true" class="size-3.5" />{/if}
          </span>
        </label>
      {/each}
      <!-- any other colour: the picker it opens under the swatches, with the hex field -->
      <button
        type="button"
        data-slot="swatch"
        class="group flex size-8 cursor-pointer items-center justify-center outline-none pointer-coarse:size-11"
        title="Custom color"
        aria-label="Custom color"
        aria-expanded={panelOpen}
        aria-controls={pickerId}
        onclick={() => (customOpen = !panelOpen)}
      >
        <span
          class={cn(
            "ring-offset-card group-focus-visible:ring-ring size-6 rounded-full ring-offset-2 group-focus-visible:ring-2",
            picked && !swatch
              ? "ring-2 ring-(--swatch)"
              : "bg-[conic-gradient(#dc2626,#ca8a04,#16a34a,#0891b2,#2563eb,#9333ea,#db2777,#dc2626)]"
          )}
          style:--swatch={picked}
          style:background={picked && !swatch ? picked : undefined}
        ></span>
      </button>
    </div>
    {#if panelOpen}
      <div id={pickerId} class="flex flex-col gap-3">
        <ColorPicker value={picked} onpick={(hex) => ($fields.colorHex = hex)}>
          {#snippet field()}
            <!-- typed or pasted, as a brand guide gives it; this is the field the form posts -->
            <Form.Control>
              {#snippet children({ props })}
                <div class="relative min-w-0 flex-1">
                  <!-- the label sits in the box, as a prefix; a click on it reaches the field -->
                  <Form.Label
                    class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs font-normal"
                    >Hex</Form.Label
                  >
                  <Input
                    {...props}
                    bind:value={() => $fields.colorHex, hexTypedIn}
                    maxlength={7}
                    autocomplete="off"
                    spellcheck={false}
                    placeholder="#2563EB"
                    class="w-full pl-11 font-mono text-xs uppercase"
                  />
                </div>
              {/snippet}
            </Form.Control>
          {/snippet}
        </ColorPicker>
      </div>
    {/if}
    <!-- said as it appears, and only then; a pale colour still saves -->
    <div aria-live="polite" class="empty:hidden">
      {#if picked && contrastWithWhite(picked) < HARD_TO_SEE_BELOW}
        {@const shade = darkerShade(picked)}
        <Notice variant="warning" title="Hard to see in light mode">
          The icon fades into its tile on a light screen.
          <!-- the preview and the fix share one height, so the row lines up; on touch both grow to a finger's -->
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <!-- a light screen's card whatever the theme, so the dark theme shows it too; no edge, as it is not a button -->
            <span
              class="flex h-7 items-center gap-1.5 rounded-md bg-white pr-2.5 pl-0.5 text-[0.8rem] text-neutral-600 pointer-coarse:h-11"
            >
              <RecordTile
                light
                iconName={$fields.iconName}
                colorHex={picked}
                class="size-6 [&_svg]:size-3.5"
              />
              On a light screen
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="pointer-coarse:h-11"
              onclick={() => ($fields.colorHex = shade)}
            >
              <span aria-hidden="true" class="size-3 rounded-full" style:background={shade}></span>
              Use a darker shade
            </Button>
          </div>
        </Notice>
      {/if}
    </div>
    <Form.FieldErrors class={HINT} />
  </Form.Fieldset>

  <Form.Fieldset form={superform} name={ICON} class="space-y-2">
    <!-- the chosen icon's name beside the heading, as touch has no tooltip; the radios say it to a screen reader -->
    <Form.Legend
      >Icon <span aria-hidden="true" class="text-muted-foreground font-normal"
        >· {iconLabel($fields.iconName)}</span
      ></Form.Legend
    >
    <!-- the stored name, for one no tile shows; a checked tile, posted after it, wins -->
    <input type="hidden" name="iconName" value={$fields.iconName} />
    <IconPicker
      name="iconName"
      value={$fields.iconName}
      onpick={(name) => ($fields.iconName = name)}
      suggestFor={$fields.name}
      color={picked ?? PENDING_COLOR}
    />
    <Form.FieldErrors class={HINT} />
  </Form.Fieldset>
</FormSection>
