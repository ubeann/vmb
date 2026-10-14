<!--
  A Division's create or edit form (#302), in the layer over the list and on
  the full page alike. The fields check the shared schema's rules as they are
  typed, and the server checks the same ones.
-->
<script lang="ts">
  import RecordForm from "$lib/components/form/RecordForm.svelte";
  import { useRecordForm } from "$lib/components/form/record-form.js";
  import RecordTile from "$lib/components/list/RecordTile.svelte";
  import * as Form from "$lib/components/ui/form/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
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
    reloadHref,
    onreload,
    cancelHref,
    oncancel,
    onsaved
  }: {
    form: SuperValidated<Fields>;
    /** The route that saves it, when the form sits in the layer over the list. */
    action?: string;
    submitLabel?: string;
    pendingLabel?: string;
    /** The edit page, which a conflict's Reload opens fresh. */
    reloadHref?: string;
    /** In the layer: a conflict's Reload loads the record again there. */
    onreload?: () => void;
    cancelHref?: string;
    oncancel?: () => void;
    /** In the layer: called once saved, in place of opening the record's page. */
    onsaved?: (saved: Fields) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const { superform, guard } = useRecordForm(form, {
    validators: zod4Client(DivisionInputSchema),
    onsaved: (saved) => onsaved?.(saved)
  });
  const { form: fields, errors } = superform;

  // the picker shows the typed colour once it is a whole one
  const picked = $derived(HEX.test($fields.colorHex) ? $fields.colorHex : "#000000");
</script>

<RecordForm {superform} {guard} {action} {submitLabel} {pendingLabel} {cancelHref} {oncancel}>
  {#if reloadHref && $fields.updatedAt !== undefined}
    <UpdatedAtField value={$fields.updatedAt} error={$errors.updatedAt} {reloadHref} {onreload} />
  {/if}

  <Form.Field form={superform} name="name">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Name</Form.Label>
        <Input {...props} bind:value={$fields.name} maxlength={255} autocomplete="off" />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>

  <Form.Field form={superform} name="code">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Code</Form.Label>
        <Input
          {...props}
          bind:value={$fields.code}
          maxlength={5}
          autocomplete="off"
          class="font-mono"
        />
      {/snippet}
    </Form.Control>
    <Form.Description>3 to 5 characters, such as OPS.</Form.Description>
    <Form.FieldErrors />
  </Form.Field>

  <Form.Field form={superform} name="description">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Description</Form.Label>
        <Textarea {...props} bind:value={$fields.description} maxlength={1000} rows={3} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>

  <Form.Field form={superform} name="colorHex">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Color</Form.Label>
        <div class="flex items-center gap-2">
          <!-- a picker beside the text: the text is what is sent -->
          <input
            type="color"
            aria-label="Pick a color"
            value={picked}
            oninput={(event) => ($fields.colorHex = event.currentTarget.value.toUpperCase())}
            class="border-input size-8 shrink-0 cursor-pointer rounded-(--control-radius) border bg-transparent p-0.5 pointer-coarse:size-11"
          />
          <Input
            {...props}
            bind:value={$fields.colorHex}
            maxlength={7}
            autocomplete="off"
            spellcheck={false}
            class="font-mono"
          />
        </div>
      {/snippet}
    </Form.Control>
    <Form.Description>A hex value such as #2563EB.</Form.Description>
    <Form.FieldErrors />
  </Form.Field>

  <Form.Field form={superform} name="iconName">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Icon</Form.Label>
        <div class="flex items-center gap-2">
          <RecordTile
            iconName={$fields.iconName}
            colorHex={picked}
            class="size-8 pointer-coarse:size-11"
          />
          <Input
            {...props}
            bind:value={$fields.iconName}
            maxlength={255}
            autocomplete="off"
            spellcheck={false}
            class="font-mono"
          />
        </div>
      {/snippet}
    </Form.Control>
    <Form.Description>A Heroicon name, such as heroicon-o-cog-6-tooth.</Form.Description>
    <Form.FieldErrors />
  </Form.Field>

  <Form.Field form={superform} name="isActive">
    <Form.Control>
      {#snippet children({ props })}
        <div class="flex min-h-8 items-center justify-between gap-4 pointer-coarse:min-h-11">
          <Form.Label>Active</Form.Label>
          <Switch {...props} bind:checked={$fields.isActive} />
        </div>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
</RecordForm>
