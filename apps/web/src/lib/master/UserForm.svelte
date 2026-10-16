<!--
  A User's create or edit form (#304), on its full page: three sections,
  Personal details, Authorization and Security, as the legacy form had them.
  Roles are chosen from a searchable list, and the Status says what it does;
  making a user Suspended or Inactive asks first, because saving ends their
  sessions. The password is asked on create only, with its length reading; a
  user changes it through the activation flow, and the API's own refusals (a
  breached or context password) land on its field. The fields check the
  shared schema's rules as they are typed, and the server checks the same ones.
-->
<script lang="ts">
  import FormSection from "$lib/components/form/FormSection.svelte";
  import RecordForm from "$lib/components/form/RecordForm.svelte";
  import { useRecordForm } from "$lib/components/form/record-form.js";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import PasswordMeter from "$lib/components/PasswordMeter.svelte";
  import * as Form from "$lib/components/ui/form/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import {
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    USER_STATUS_LABELS,
    USER_STATUSES,
    UserCreateInputSchema,
    UserUpdateInputSchema,
    type UserStatus
  } from "@vmb/types";
  import type { SuperValidated } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";
  import type { UserFormFields as Fields } from "./form-data.js";
  import type { RoleOption } from "./loads.js";
  import RoleCombobox from "./RoleCombobox.svelte";
  import StatusConfirmDialog from "./StatusConfirmDialog.svelte";
  import UpdatedAtField from "./UpdatedAtField.svelte";

  let {
    form,
    roles,
    passwordRequired = false,
    reloadHref,
    cancelHref
  }: {
    form: SuperValidated<Fields>;
    /** What can be chosen, with every role the user already holds. */
    roles: RoleOption[];
    /** A new user: the password is asked, and the form says Create. */
    passwordRequired?: boolean;
    /** The edit page, which a conflict's Reload opens fresh. */
    reloadHref?: string;
    cancelHref?: string;
  } = $props();

  // the status the user was loaded with, to know when a save would stop them signing in
  // svelte-ignore state_referenced_locally
  const savedStatus: UserStatus = form.data.status;
  // an edit's name as it was loaded, for "Discard changes to Rina?"; a new user has none
  // svelte-ignore state_referenced_locally
  const savedName = reloadHref ? form.data.name : undefined;

  let confirm = $state<ReturnType<typeof StatusConfirmDialog>>();

  // svelte-ignore state_referenced_locally
  const { superform, guard } = useRecordForm(form, {
    // a new user's schema also asks for the password and its repeat
    validators: zod4Client(
      passwordRequired ? UserCreateInputSchema : UserUpdateInputSchema
    ) as never,
    // only a save that takes an Active user out of Active asks; the sessions end with it
    beforeSubmit: ({ status }) => {
      if (passwordRequired || savedStatus !== "active" || status === "active") return true;
      return confirm?.ask(status) ?? true;
    }
  });
  const { form: fields, errors } = superform;

  const passwordLength = $derived($fields.password.length);
  // hints sit close under their field, a step smaller than its label
  const HINT = "text-xs";
</script>

<RecordForm
  {superform}
  {guard}
  submitLabel={passwordRequired ? "Create user" : "Save user"}
  pendingLabel={passwordRequired ? "Creating…" : "Saving…"}
  submitIcon={passwordRequired ? PlusIcon : CheckIcon}
  {cancelHref}
  discard={{
    noun: "user",
    name: savedName,
    fields: {
      name: "name",
      email: "email",
      phone: "phone number",
      profilePhotoPath: "photo",
      roleIds: "roles",
      status: "status",
      password: "password"
    }
  }}
>
  {#if reloadHref && $fields.updatedAt !== undefined}
    <UpdatedAtField value={$fields.updatedAt} error={$errors.updatedAt} {reloadHref} />
  {/if}

  <FormSection title="Personal details" hint="Who they are, and how to reach them.">
    <Form.Field form={superform} name="name" class="space-y-1.5">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Name</Form.Label>
          <Input {...props} bind:value={$fields.name} maxlength={255} autocomplete="off" />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class={HINT} />
    </Form.Field>

    <Form.Field form={superform} name="email" class="space-y-1.5">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Email</Form.Label>
          <Input
            {...props}
            type="email"
            bind:value={$fields.email}
            maxlength={255}
            autocomplete="off"
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class={HINT} />
    </Form.Field>

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
            autocomplete="off"
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
        >Without one, they get a picture drawn from their id.</Form.Description
      >
      <Form.FieldErrors class={HINT} />
    </Form.Field>
  </FormSection>

  <FormSection title="Authorization" hint="What they may do, and whether they may sign in.">
    <Form.Field form={superform} name="roleIds" class="space-y-1.5">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Roles</Form.Label>
          <RoleCombobox
            id={props.id}
            {roles}
            bind:value={$fields.roleIds}
            invalid={props["aria-invalid"] === "true"}
            describedby={props["aria-describedby"]}
          />
        {/snippet}
      </Form.Control>
      <Form.Description class={HINT}
        >A user belongs to the divisions their roles are scoped to. A role of an Inactive Division
        can't be given to anyone new.</Form.Description
      >
      <Form.FieldErrors class={HINT} />
    </Form.Field>

    <Form.Field form={superform} name="status" class="space-y-1.5">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Status</Form.Label>
          <Select.Root type="single" bind:value={$fields.status} name={props.name}>
            <Select.Trigger {...props} class="w-full">
              {USER_STATUS_LABELS[$fields.status]}
            </Select.Trigger>
            <Select.Content>
              {#each USER_STATUSES as status (status)}
                <Select.Item value={status} label={USER_STATUS_LABELS[status]} />
              {/each}
            </Select.Content>
          </Select.Root>
        {/snippet}
      </Form.Control>
      <Form.Description class={HINT}
        >Suspended and Inactive users can't sign in, and their sessions end when you save.</Form.Description
      >
      <Form.FieldErrors class={HINT} />
    </Form.Field>
  </FormSection>

  {#if passwordRequired}
    <FormSection title="Security" hint="They can change it after they sign in.">
      <Form.Field form={superform} name="password" class="space-y-1.5">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Password</Form.Label>
            <PasswordInput
              {...props}
              value={$fields.password}
              oninput={(event) => ($fields.password = event.currentTarget.value)}
              minlength={PASSWORD_MIN_LENGTH}
              maxlength={PASSWORD_MAX_LENGTH}
              autocomplete="new-password"
            />
          {/snippet}
        </Form.Control>
        <div class="space-y-2 pt-0.5 text-sm">
          <PasswordMeter length={passwordLength} />
        </div>
        <Form.FieldErrors class={HINT} />
      </Form.Field>

      <Form.Field form={superform} name="passwordConfirmation" class="space-y-1.5">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Confirm password</Form.Label>
            <PasswordInput
              {...props}
              value={$fields.passwordConfirmation}
              oninput={(event) => ($fields.passwordConfirmation = event.currentTarget.value)}
              minlength={PASSWORD_MIN_LENGTH}
              maxlength={PASSWORD_MAX_LENGTH}
              autocomplete="new-password"
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors class={HINT} />
      </Form.Field>
    </FormSection>
  {/if}
</RecordForm>

<StatusConfirmDialog bind:this={confirm} name={$fields.name} />
