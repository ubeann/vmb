<!--
  A Division's create or edit form (#302), in the layer over the list and on
  the full page alike. The fields check the shared schema's rules as they are
  typed, and the server checks the same ones.
-->
<script lang="ts">
  import FormSection from "$lib/components/form/FormSection.svelte";
  import RecordForm from "$lib/components/form/RecordForm.svelte";
  import { useRecordForm } from "$lib/components/form/record-form.js";
  import RecordTile from "$lib/components/list/RecordTile.svelte";
  import * as Form from "$lib/components/ui/form/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { cn } from "$lib/utils.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import type { Component } from "svelte";
  import AppearanceFields from "./AppearanceFields.svelte";
  import { pickedColor, PENDING_COLOR, suggestCode, type DivisionDraft } from "./appearance.js";
  import type { DivisionFormFields as Fields } from "./form-data.js";
  import UpdatedAtField from "./UpdatedAtField.svelte";
  import { DivisionInputSchema } from "@vmb/types";
  import type { SuperValidated } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";

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

  // the preview and the layer's header show the typed colour once it is a whole one
  const picked = $derived(pickedColor($fields.colorHex));
  // A new Division's code follows its name until the code is typed in; an
  // existing one keeps its own
  // svelte-ignore state_referenced_locally
  let codeTyped = $state(Boolean(form.data.code));
  const FOLLOWS_NAME = "Filled from the name until you type your own";
  // an edit's name as it was loaded, for "Discard changes to Finance?"; a new Division has none
  // svelte-ignore state_referenced_locally
  const savedName = reloadHref ? form.data.name : undefined;
  function nameTyped(name: string) {
    $fields.name = name;
    if (!codeTyped) $fields.code = suggestCode(name);
  }
  // a typed code of the wrong length can only be wrong for that; any other error says its own
  const codeLengthWrong = $derived.by(() => {
    const length = $fields.code.trim().length;
    return length > 0 && (length < 3 || length > 5);
  });
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

{#snippet preview(color: string)}
  <div class="bg-muted/50 flex items-center gap-3 rounded-lg px-3 py-2.5" aria-hidden="true">
    <RecordTile iconName={$fields.iconName} colorHex={color} class="size-9" />
    <div class="flex min-w-0 flex-col">
      <span class={cn("truncate font-medium", !$fields.name && "text-muted-foreground")}
        >{$fields.name || "Division name"}</span
      >
      <span class="text-muted-foreground font-mono text-xs">{$fields.code || "CODE"}</span>
    </div>
    <span class="text-muted-foreground ml-auto text-xs">Preview</span>
  </div>
{/snippet}

<RecordForm
  {superform}
  {guard}
  {action}
  {submitLabel}
  {pendingLabel}
  {submitIcon}
  {cancelHref}
  {oncancel}
  discard={{
    noun: "division",
    name: savedName,
    fields: {
      name: "name",
      code: "code",
      description: "description",
      colorHex: "color",
      iconName: "icon",
      isActive: "status"
    }
  }}
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

  <AppearanceFields {superform} preview={ondraft ? undefined : preview} />

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
