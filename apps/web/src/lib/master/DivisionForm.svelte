<script lang="ts">
  import type { DivisionInput } from "@vmb/types";
  import { superForm, type SuperValidated } from "sveltekit-superforms";

  let {
    form,
    submitLabel = "Save division"
  }: { form: SuperValidated<DivisionInput>; submitLabel?: string } = $props();

  // svelte-ignore state_referenced_locally
  const { form: fields, errors, enhance, submitting } = superForm(form);
</script>

<form method="POST" use:enhance>
  <fieldset>
    <legend>Basic information</legend>

    <label>
      <span>Name</span>
      <input name="name" bind:value={$fields.name} maxlength="255" required />
      {#if $errors.name}<span class="error">{$errors.name[0]}</span>{/if}
    </label>

    <label>
      <span>Code (3–5 characters)</span>
      <input name="code" bind:value={$fields.code} minlength="3" maxlength="5" required />
      {#if $errors.code}<span class="error">{$errors.code[0]}</span>{/if}
    </label>

    <label>
      <span>Description</span>
      <textarea name="description" bind:value={$fields.description} maxlength="1000" rows="3"
      ></textarea>
      {#if $errors.description}<span class="error">{$errors.description[0]}</span>{/if}
    </label>
  </fieldset>

  <fieldset>
    <legend>Visual attributes</legend>

    <label>
      <span>Color</span>
      <input type="color" name="colorHex" bind:value={$fields.colorHex} required />
      {#if $errors.colorHex}<span class="error">{$errors.colorHex[0]}</span>{/if}
    </label>

    <label>
      <span>Icon name</span>
      <input name="iconName" bind:value={$fields.iconName} maxlength="255" required />
      {#if $errors.iconName}<span class="error">{$errors.iconName[0]}</span>{/if}
    </label>
  </fieldset>

  <fieldset>
    <legend>Settings</legend>
    <label>
      <input type="checkbox" name="isActive" bind:checked={$fields.isActive} />
      <input type="hidden" name="isActive" value="false" />
      <span>Active</span>
    </label>
  </fieldset>

  <button type="submit" disabled={$submitting}>{submitLabel}</button>
</form>
