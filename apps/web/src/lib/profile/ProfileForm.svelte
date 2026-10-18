<!--
  A signed-in person's own profile form (#458): the name, phone number and
  photo link an administrator's User form also has, under the same shared
  schema, and the email shown but not editable. The email is what proves inbox
  control at activation (ADR-0033), so changing it stays with an administrator;
  it is text here, not a field, so nothing submits it. Saving needs no password.
  The server checks the same rules as the fields do as they are typed.
-->
<script lang="ts">
  import FormSection from "$lib/components/form/FormSection.svelte";
  import RecordForm from "$lib/components/form/RecordForm.svelte";
  import { useRecordForm } from "$lib/components/form/record-form.js";
  import * as Form from "$lib/components/ui/form/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import { ProfileUpdateInputSchema, type ProfileUpdateInput } from "@vmb/types";
  import type { SuperValidated } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";

  let {
    form,
    email,
    cancelHref
  }: {
    form: SuperValidated<ProfileUpdateInput>;
    /** Shown, never submitted. */
    email: string;
    cancelHref?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  const { superform, guard } = useRecordForm(form, {
    validators: zod4Client(ProfileUpdateInputSchema) as never
  });
  const { form: fields } = superform;

  // hints sit close under their field, a step smaller than its label
  const HINT = "text-xs";
</script>

<RecordForm
  {superform}
  {guard}
  submitLabel="Save profile"
  pendingLabel="Saving…"
  submitIcon={CheckIcon}
  {cancelHref}
  discard={{
    noun: "profile",
    name: "your profile",
    fields: { name: "name", phone: "phone number", profilePhotoPath: "photo" }
  }}
>
  <FormSection
    title="Personal information"
    hint="How you appear in VMB, and how to reach you."
    level={2}
  >
    <Form.Field form={superform} name="name" class="space-y-1.5">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Name</Form.Label>
          <Input {...props} bind:value={$fields.name} maxlength={255} autocomplete="name" />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class={HINT} />
    </Form.Field>

    <dl class="space-y-1.5">
      <dt class="text-sm leading-snug font-medium">Email</dt>
      <dd class="min-w-0 text-sm break-words">{email}</dd>
      <dd class="text-muted-foreground text-xs">Ask an administrator to change it.</dd>
    </dl>

    <Form.Field form={superform} name="phone" class="space-y-1.5">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Phone number</Form.Label>
          <Input
            {...props}
            type="tel"
            bind:value={$fields.phone}
            maxlength={20}
            placeholder="+62 811 1000 0001"
            autocomplete="tel"
          />
        {/snippet}
      </Form.Control>
      <Form.Description class={HINT}>An Indonesian number, with +62 or 0 first.</Form.Description>
      <Form.FieldErrors class={HINT} />
    </Form.Field>

    <Form.Field form={superform} name="profilePhotoPath" class="space-y-1.5">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label
            >Photo link <span class="text-muted-foreground font-normal">(optional)</span
            ></Form.Label
          >
          <Input
            {...props}
            bind:value={$fields.profilePhotoPath}
            maxlength={255}
            autocomplete="off"
            placeholder="https://"
          />
        {/snippet}
      </Form.Control>
      <Form.Description class={HINT}
        >Without one, you get a picture drawn from your id.</Form.Description
      >
      <Form.FieldErrors class={HINT} />
    </Form.Field>
  </FormSection>
</RecordForm>
