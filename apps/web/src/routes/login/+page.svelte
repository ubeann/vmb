<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
  <title>Log in — VMB</title>
</svelte:head>

<h1>Log in</h1>

{#if form?.error}
  <p role="alert">{form.error}</p>
{/if}

<form method="POST" use:enhance>
  <label>
    Email
    <input type="email" name="email" autocomplete="email" required />
  </label>

  <label>
    Password
    <input type="password" name="password" autocomplete="current-password" required />
  </label>

  <button type="submit">Log in</button>
</form>

<p>Don't have an account? <a href={resolve("/signup")}>Sign up</a></p>
