<script lang="ts">
  import {
    USER_STATUS_LABELS,
    USER_STATUSES,
    type Division,
    type UserUpdateInput
  } from "@vmb/types";
  import { superForm, type SuperValidated } from "sveltekit-superforms";

  let {
    form,
    divisions,
    passwordRequired = false,
    submitLabel = "Save user"
  }: {
    form: SuperValidated<UserUpdateInput>;
    divisions: Division[];
    passwordRequired?: boolean;
    submitLabel?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  const { form: fields, errors, enhance, submitting } = superForm(form);
</script>

<form method="POST" use:enhance>
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

    <label>
      <span>Division</span>
      <select name="divisionId" bind:value={$fields.divisionId} required>
        <option value="">Choose a division</option>
        {#each divisions as division (division.id)}
          <option value={division.id}>{division.name}</option>
        {/each}
      </select>
      {#if $errors.divisionId}<span class="error">{$errors.divisionId[0]}</span>{/if}
    </label>

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
          (minimum 8 characters)
        {:else}
          (leave blank to keep the current password)
        {/if}
      </span>
      <input
        type="password"
        name="password"
        bind:value={$fields.password}
        minlength="8"
        maxlength="255"
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
        minlength="8"
        maxlength="255"
        required={passwordRequired}
      />
      {#if $errors.passwordConfirmation}<span class="error">{$errors.passwordConfirmation[0]}</span
        >{/if}
    </label>
  </fieldset>

  <button type="submit" disabled={$submitting}>{submitLabel}</button>
</form>
