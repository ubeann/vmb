<script lang="ts">
  import UpdatedAtField from "./UpdatedAtField.svelte";
  import {
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    USER_STATUS_LABELS,
    USER_STATUSES,
    UserUpdateInputSchema,
    type UserUpdateInput
  } from "@vmb/types";
  import { superForm, type SuperValidated } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";

  // a new user's form has no `updatedAt`; an edit's carries the one it loaded
  type Fields = Omit<UserUpdateInput, "updatedAt"> & { updatedAt?: string | null };

  let {
    form,
    roles,
    passwordRequired = false,
    submitLabel = "Save user",
    reloadHref
  }: {
    form: SuperValidated<Fields>;
    roles: Array<{ id: string; name: string }>;
    passwordRequired?: boolean;
    submitLabel?: string;
    reloadHref?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  const {
    form: fields,
    errors,
    enhance,
    submitting
  } = superForm(form, {
    validators: zod4Client(UserUpdateInputSchema)
  });
</script>

<form method="POST" use:enhance>
  {#if reloadHref && $fields.updatedAt !== undefined}
    <UpdatedAtField value={$fields.updatedAt} error={$errors.updatedAt} {reloadHref} />
  {/if}

  <fieldset>
    <legend>Personal details</legend>

    <label>
      <span>Name</span>
      <input name="name" bind:value={$fields.name} maxlength="255" required />
      {#if $errors.name}<span class="error">{$errors.name[0]}</span>{/if}
    </label>

    <label>
      <span>Email</span>
      <input type="email" name="email" bind:value={$fields.email} maxlength="255" required />
      {#if $errors.email}<span class="error">{$errors.email[0]}</span>{/if}
    </label>

    <label>
      <span>Phone (Indonesian, +62)</span>
      <input type="tel" name="phone" bind:value={$fields.phone} maxlength="20" required />
      {#if $errors.phone}<span class="error">{$errors.phone[0]}</span>{/if}
    </label>

    <label>
      <span>Profile photo URL</span>
      <input name="profilePhotoPath" bind:value={$fields.profilePhotoPath} maxlength="255" />
      {#if $errors.profilePhotoPath}<span class="error">{$errors.profilePhotoPath[0]}</span>{/if}
    </label>
  </fieldset>

  <fieldset>
    <legend>Authorization</legend>

    <fieldset class="roles">
      <legend>Roles</legend>
      {#each roles as role (role.id)}
        <label>
          <input type="checkbox" name="roleIds" value={role.id} bind:group={$fields.roleIds} />
          <span>{role.name}</span>
        </label>
      {:else}
        <p class="muted">No roles to choose from.</p>
      {/each}
      {#if $errors.roleIds}<span class="error">{$errors.roleIds._errors?.[0]}</span>{/if}
    </fieldset>

    <label>
      <span>Status</span>
      <select name="status" bind:value={$fields.status}>
        {#each USER_STATUSES as status (status)}
          <option value={status}>{USER_STATUS_LABELS[status]}</option>
        {/each}
      </select>
      {#if $errors.status}<span class="error">{$errors.status[0]}</span>{/if}
    </label>
  </fieldset>

  <fieldset>
    <legend>Security</legend>

    <label>
      <span>
        Password
        {#if passwordRequired}
          ({PASSWORD_MIN_LENGTH}–{PASSWORD_MAX_LENGTH} characters)
        {:else}
          (leave blank to keep the current password)
        {/if}
      </span>
      <input
        type="password"
        name="password"
        bind:value={$fields.password}
        minlength={PASSWORD_MIN_LENGTH}
        maxlength={PASSWORD_MAX_LENGTH}
        required={passwordRequired}
      />
      {#if $errors.password}<span class="error">{$errors.password[0]}</span>{/if}
    </label>

    <label>
      <span>Confirm password</span>
      <input
        type="password"
        name="passwordConfirmation"
        bind:value={$fields.passwordConfirmation}
        minlength={PASSWORD_MIN_LENGTH}
        maxlength={PASSWORD_MAX_LENGTH}
        required={passwordRequired}
      />
      {#if $errors.passwordConfirmation}<span class="error">{$errors.passwordConfirmation[0]}</span
        >{/if}
    </label>
  </fieldset>

  <button type="submit" disabled={$submitting}>{submitLabel}</button>
</form>
