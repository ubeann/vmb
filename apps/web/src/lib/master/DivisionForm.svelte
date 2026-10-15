<!--
  A Division's create or edit form (#302), in the layer over the list and on
  the full page alike. The fields check the shared schema's rules as they are
  typed, and the server checks the same ones.
-->
<script lang="ts">
  import ColorPicker from "$lib/components/form/ColorPicker.svelte";
  import { contrastWithWhite, darkerShade, HARD_TO_SEE_BELOW } from "$lib/components/form/color.js";
  import FormSection from "$lib/components/form/FormSection.svelte";
  import IconPicker from "$lib/components/form/IconPicker.svelte";
  import { iconLabel } from "$lib/components/hero-icons.js";
  import RecordForm from "$lib/components/form/RecordForm.svelte";
  import { useRecordForm } from "$lib/components/form/record-form.js";
  import RecordTile from "$lib/components/list/RecordTile.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Form from "$lib/components/ui/form/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { cn } from "$lib/utils.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import type { Component } from "svelte";
  import { PENDING_COLOR, SWATCHES, suggestCode, type DivisionDraft } from "./appearance.js";
  import type { DivisionFormFields as Fields } from "./form-data.js";
  import UpdatedAtField from "./UpdatedAtField.svelte";
  import { DivisionInputSchema } from "@vmb/types";
  import type { SuperValidated } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";

  const HEX = /^#[0-9a-fA-F]{6}$/;

  let {
    form,
    action,
    submitLabel = "Save division",
    pendingLabel = "Saving…",
    submitIcon = CheckIcon,
    reloadHref,
    onreload,
    cancelHref,
    oncancel,
    onsaved,
    ondraft
  }: {
    form: SuperValidated<Fields>;
    /** The route that saves it, when the form sits in the layer over the list. */
    action?: string;
    submitLabel?: string;
    pendingLabel?: string;
    /** A check to save; New passes a plus, as on the button that opened it. */
    submitIcon?: Component<{ class?: string; "aria-hidden"?: "true" }>;
    /** The edit page, which a conflict's Reload opens fresh. */
    reloadHref?: string;
    /** In the layer: a conflict's Reload loads the record again there. */
    onreload?: () => void;
    cancelHref?: string;
    oncancel?: () => void;
    /** In the layer: called once saved, in place of opening the record's page. */
    onsaved?: (saved: Fields) => void;
    /**
     * In the layer: what the form holds as it changes, for the layer's header to
     * show live in place of the form's own preview.
     */
    ondraft?: (draft: DivisionDraft) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const { superform, guard } = useRecordForm(form, {
    validators: zod4Client(DivisionInputSchema),
    onsaved: (saved) => onsaved?.(saved)
  });
  const { form: fields, errors, tainted, isTainted } = superform;

  // the swatches and the preview show the typed colour once it is a whole one
  const picked = $derived(HEX.test($fields.colorHex) ? $fields.colorHex.toUpperCase() : null);
  const swatch = $derived(SWATCHES.find((option) => option.hex === picked));
  // the custom picker opens under the swatches when asked for, and stays until closed
  let customOpen = $state(false);
  // a colour the checks refuse opens it, so its field and the error are in view
  const panelOpen = $derived(customOpen || Boolean($errors.colorHex));
  const pickerId = $props.id();
  // A new Division's code follows its name until the code is typed in; an
  // existing one keeps its own
  // svelte-ignore state_referenced_locally
  let codeTyped = $state(Boolean(form.data.code));
  const FOLLOWS_NAME = "Filled from the name until you type your own";
  function nameTyped(name: string) {
    $fields.name = name;
    if (!codeTyped) $fields.code = suggestCode(name);
  }
  // a typed code of the wrong length can only be wrong for that; any other error says its own
  const codeLengthWrong = $derived.by(() => {
    const length = $fields.code.trim().length;
    return length > 0 && (length < 3 || length > 5);
  });
  // a hex as design tools copy it, without its # or in lower case, is taken as it was meant
  function hexTypedIn(typed: string) {
    const bare = typed.trim().replace(/^#/, "");
    $fields.colorHex = /^[0-9a-fA-F]{6}$/.test(bare) ? `#${bare.toUpperCase()}` : typed;
  }
  function codeTypedIn(code: string) {
    $fields.code = code.toUpperCase();
    codeTyped = code !== "";
  }

  $effect(() => {
    ondraft?.({
      name: $fields.name,
      code: $fields.code,
      colorHex: picked ?? PENDING_COLOR,
      iconName: $fields.iconName,
      dirty: isTainted($tainted)
    });
  });

  // hints sit close under their field, a step smaller than its label
  const HINT = "text-xs";
</script>

<RecordForm
  {superform}
  {guard}
  {action}
  {submitLabel}
  {pendingLabel}
  {submitIcon}
  {cancelHref}
  {oncancel}
>
  {#if reloadHref && $fields.updatedAt !== undefined}
    <UpdatedAtField value={$fields.updatedAt} error={$errors.updatedAt} {reloadHref} {onreload} />
  {/if}

  <FormSection title="Details" hint="What people call it, and the short code that stands for it.">
    <!-- a code is a few letters, so it sits beside the name it is made from -->
    <div class="grid grid-cols-[minmax(0,1fr)_8rem] items-start gap-3">
      <Form.Field form={superform} name="name" class="space-y-1.5">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Name</Form.Label>
            <Input
              {...props}
              bind:value={() => $fields.name, nameTyped}
              maxlength={255}
              autocomplete="off"
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors class={HINT} />
      </Form.Field>

      <Form.Field form={superform} name="code" class="space-y-1.5">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Code</Form.Label>
            <div class="relative">
              <Input
                {...props}
                bind:value={() => $fields.code, codeTypedIn}
                maxlength={5}
                autocomplete="off"
                spellcheck={false}
                class={cn("font-mono uppercase", !codeTyped && "pr-8")}
              />
              <!-- a sparkle while the code follows the name, gone once it is the person's own; the
                   tooltip is for a mouse, and the hint below says the same to a screen reader -->
              {#if !codeTyped}
                <Tooltip.Provider delayDuration={300}>
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      {#snippet child({ props: trigger })}
                        <span
                          {...trigger}
                          aria-hidden="true"
                          data-code-follows-name=""
                          class="text-muted-foreground absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center"
                        >
                          <SparklesIcon class="size-3.5" />
                        </span>
                      {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content>{FOLLOWS_NAME}</Tooltip.Content>
                  </Tooltip.Root>
                </Tooltip.Provider>
              {/if}
            </div>
          {/snippet}
        </Form.Control>
        <!-- the hint and the error share one line: a wrong length turns the hint itself red -->
        {#if !$errors.code}
          <Form.Description class={HINT}
            >3 to 5 characters{#if !codeTyped}<span class="sr-only">. {FOLLOWS_NAME}.</span
              >{/if}</Form.Description
          >
        {/if}
        <Form.FieldErrors class={HINT}>
          {#snippet children({ errors, errorProps })}
            {#if errors[0]}
              <Form.FieldError {...errorProps}
                >{codeLengthWrong ? "3 to 5 characters" : errors[0]}</Form.FieldError
              >
            {/if}
          {/snippet}
        </Form.FieldErrors>
      </Form.Field>
    </div>

    <Form.Field form={superform} name="description" class="space-y-1.5">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label
            >Description <span class="text-muted-foreground font-normal">(optional)</span
            ></Form.Label
          >
          <!-- an example in the seeded ones' manner: one short line is enough -->
          <Textarea
            {...props}
            bind:value={$fields.description}
            maxlength={1000}
            rows={2}
            placeholder="Such as budgets, invoices and payment settlement"
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class={HINT} />
    </Form.Field>
  </FormSection>

  <FormSection title="Appearance" hint="How it shows in lists and menus.">
    <!-- how it will look in the lists, as it is chosen; in the layer its header shows it instead -->
    {#if !ondraft}
      <div class="bg-muted/50 flex items-center gap-3 rounded-lg px-3 py-2.5" aria-hidden="true">
        <RecordTile iconName={$fields.iconName} colorHex={picked ?? PENDING_COLOR} class="size-9" />
        <div class="flex min-w-0 flex-col">
          <span class={cn("truncate font-medium", !$fields.name && "text-muted-foreground")}
            >{$fields.name || "Division name"}</span
          >
          <span class="text-muted-foreground font-mono text-xs">{$fields.code || "CODE"}</span>
        </div>
        <span class="text-muted-foreground ml-auto text-xs">Preview</span>
      </div>
    {/if}

    <Form.Fieldset form={superform} name="colorHex" class="space-y-2">
      <!-- the chosen colour's name beside the heading, as the icon's is; the radios say it to a screen reader -->
      <Form.Legend
        >Color <span aria-hidden="true" class="text-muted-foreground font-normal"
          >· {swatch?.label ?? (picked || $fields.colorHex || "None")}</span
        ></Form.Legend
      >
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
            <!-- not sent: the hex field is what the form posts -->
            <input
              type="radio"
              name="colorSwatch"
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
      {:else}
        <input type="hidden" name="colorHex" value={$fields.colorHex} />
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
                <span aria-hidden="true" class="size-3 rounded-full" style:background={shade}
                ></span>
                Use a darker shade
              </Button>
            </div>
          </Notice>
        {/if}
      </div>
      <Form.FieldErrors class={HINT} />
    </Form.Fieldset>

    <Form.Fieldset form={superform} name="iconName" class="space-y-2">
      <!-- the chosen icon's name beside the heading, as touch has no tooltip; the radios say it to a screen reader -->
      <Form.Legend
        >Icon <span aria-hidden="true" class="text-muted-foreground font-normal"
          >· {iconLabel($fields.iconName)}</span
        ></Form.Legend
      >
      <!-- the picker reports a pick; this is what posts -->
      <input type="hidden" name="iconName" value={$fields.iconName} />
      <IconPicker
        value={$fields.iconName}
        onpick={(name) => ($fields.iconName = name)}
        suggestFor={$fields.name}
        color={picked ?? PENDING_COLOR}
      />
      <Form.FieldErrors class={HINT} />
    </Form.Fieldset>
  </FormSection>

  <FormSection>
    <Form.Field form={superform} name="isActive" class="space-y-1">
      <Form.Control>
        {#snippet children({ props })}
          <div class="flex min-h-8 items-center justify-between gap-4 pointer-coarse:min-h-11">
            <div class="flex flex-col gap-1">
              <Form.Label>Active</Form.Label>
              <Form.Description class={HINT}
                >An inactive division stays in the list, marked Inactive.</Form.Description
              >
            </div>
            <Switch {...props} bind:checked={$fields.isActive} />
          </div>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class={HINT} />
    </Form.Field>
  </FormSection>
</RecordForm>
