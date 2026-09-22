<script lang="ts">
  import { ROLE_ACCESS_LEVELS, type RoleInput } from "@vmb/types";
  import { superForm, type SuperValidated } from "sveltekit-superforms";

  let {
    form,
    submitLabel = "Save role"
  }: { form: SuperValidated<RoleInput>; submitLabel?: string } = $props();

  // svelte-ignore state_referenced_locally
  const { form: fields, errors, enhance, submitting } = superForm(form);
</script>

<form method="POST" use:enhance>
  <fieldset>
    <legend>Basic information</legend>

    <label>
      <span>Role name</span>
      <input name="name" bind:value={$fields.name} maxlength="255" required />
      {#if $errors.name}<span class="error">{$errors.name[0]}</span>{/if}
    </label>

    <label>
      <span>Access level</span>
      <select name="level" bind:value={$fields.level}>
        {#each ROLE_ACCESS_LEVELS as level (level.value)}
          <option value={level.value}>{level.label}</option>
        {/each}
      </select>
      {#if $errors.level}<span class="error">{$errors.level[0]}</span>{/if}
    </label>

    <label>
      <span>Description</span>
      <textarea name="description" bind:value={$fields.description} maxlength="255" rows="3"
      ></textarea>
      {#if $errors.description}<span class="error">{$errors.description[0]}</span>{/if}
    </label>
  </fieldset>

  <fieldset>
    <legend>Visual settings</legend>

    <label>
      <span>Theme color</span>
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
    <legend>Status</legend>
    <label>
      <input type="checkbox" name="isActive" bind:checked={$fields.isActive} />
      <input type="hidden" name="isActive" value="false" />
      <span>Active</span>
    </label>
  </fieldset>

  <button type="submit" disabled={$submitting}>{submitLabel}</button>
</form>
