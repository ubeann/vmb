<!--
  A Role's create or edit form (#303), in the layer over the list and on the
  full page alike. The fields check the shared schema's rules as they are
  typed, and the server checks the same ones. A System Role never reaches it:
  the API refuses to edit one. Its Permissions section grants and revokes
  only what the caller holds (#462, ADR-0045's amendment of 2026-10-17). Its
  Division moves every user who holds the Role, so an edit that changes it says
  how many (#463).
-->
<script lang="ts">
  import FormSection from "$lib/components/form/FormSection.svelte";
  import RecordForm from "$lib/components/form/RecordForm.svelte";
  import { useRecordForm } from "$lib/components/form/record-form.js";
  import RecordTile from "$lib/components/list/RecordTile.svelte";
  import * as Form from "$lib/components/ui/form/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { cn } from "$lib/utils.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import type { Component } from "svelte";
  import AppearanceFields from "./AppearanceFields.svelte";
  import { pickedColor, PENDING_COLOR, type RoleDraft } from "./appearance.js";
  import DivisionCombobox from "./DivisionCombobox.svelte";
  import { RoleFormSchema, type RoleFormFields as Fields } from "./form-data.js";
  import type { DivisionChoice } from "./loads.js";
  import PermissionGrants from "./PermissionGrants.svelte";
  import UpdatedAtField from "./UpdatedAtField.svelte";
  import type { SuperValidated } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";

  let {
    form,
    held,
    divisions,
    holders = 0,
    action,
    submitLabel = "Save role",
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
    /** The caller's own permissions: the only grants they may add or take away. */
    held: readonly string[];
    /** The Divisions it can be placed in, and the one it is in already. */
    divisions: DivisionChoice[];
    /** An edit's count of the users who hold the Role, whose division a change moves. */
    holders?: number;
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
    ondraft?: (draft: RoleDraft) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const { superform, guard } = useRecordForm(form, {
    validators: zod4Client(RoleFormSchema),
    onsaved: (saved) => onsaved?.(saved)
  });
  const { form: fields, errors, tainted, isTainted } = superform;

  const picked = $derived(pickedColor($fields.colorHex));
  // the Division it was loaded in, to tell when an edit moves it
  // svelte-ignore state_referenced_locally
  const savedDivisionId = form.data.divisionId ?? null;
  const moved = $derived(($fields.divisionId ?? null) !== savedDivisionId);

  // an edit's name as it was loaded, for "Discard changes to Staff?"; a new Role has none
  // svelte-ignore state_referenced_locally
  const savedName = reloadHref ? form.data.name : undefined;

  $effect(() => {
    ondraft?.({
      name: $fields.name,
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
    <span class={cn("truncate font-medium", !$fields.name && "text-muted-foreground")}
      >{$fields.name || "Role name"}</span
    >
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
    noun: "role",
    name: savedName,
    fields: {
      name: "name",
      description: "description",
      colorHex: "color",
      iconName: "icon",
      isActive: "status",
      divisionId: "division",
      permissionKeys: "permissions"
    }
  }}
>
  {#if reloadHref && $fields.updatedAt !== undefined}
    <UpdatedAtField value={$fields.updatedAt} error={$errors.updatedAt} {reloadHref} {onreload} />
  {/if}

  <FormSection title="Details" hint="What people call it, and what it is for.">
    <Form.Field form={superform} name="name" class="space-y-1.5">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Name</Form.Label>
          <Input {...props} bind:value={$fields.name} maxlength={255} autocomplete="off" />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class={HINT} />
    </Form.Field>

    <Form.Field form={superform} name="description" class="space-y-1.5">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label
            >Description <span class="text-muted-foreground font-normal">(optional)</span
            ></Form.Label
          >
          <Textarea
            {...props}
            bind:value={$fields.description}
            maxlength={255}
            rows={2}
            placeholder="Such as who holds it and what it lets them do"
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class={HINT} />
    </Form.Field>
  </FormSection>

  <FormSection title="Division" hint="Where it applies.">
    <Form.Field form={superform} name="divisionId" class="space-y-1.5">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Division</Form.Label>
          <DivisionCombobox
            id={props.id}
            {divisions}
            bind:value={$fields.divisionId}
            invalid={props["aria-invalid"] === "true"}
            describedby={props["aria-describedby"]}
          />
        {/snippet}
      </Form.Control>
      <Form.Description class={HINT}
        >Leave it on Every division for a role that works across them, such as Super Admin. A role
        of an Inactive Division can't be given to anyone new.</Form.Description
      >
      <!-- always in the page, so a screen reader announces the text when it appears -->
      <p class={cn(HINT, "text-pretty")} role="status">
        {#if moved && holders > 0}
          {holders}
          {holders === 1 ? "user holds" : "users hold"} this role. Their division changes with it.
        {/if}
      </p>
      <Form.FieldErrors class={HINT} />
    </Form.Field>
  </FormSection>

  <AppearanceFields {superform} preview={ondraft ? undefined : preview} />

  <FormSection title="Permissions" hint="What everyone who holds this role may do.">
    <Form.Field form={superform} name="permissionKeys" class="space-y-1.5">
      <PermissionGrants bind:value={$fields.permissionKeys} {held} />
      <Form.FieldErrors class={HINT} />
    </Form.Field>
  </FormSection>

  <FormSection>
    <Form.Field form={superform} name="isActive" class="space-y-1">
      <Form.Control>
        {#snippet children({ props })}
          <div class="flex min-h-8 items-center justify-between gap-4 pointer-coarse:min-h-11">
            <div class="flex flex-col gap-1">
              <Form.Label>Active</Form.Label>
              <Form.Description class={HINT}
                >An inactive role stays in the list, marked Inactive.</Form.Description
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
