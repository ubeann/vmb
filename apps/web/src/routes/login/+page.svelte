<script lang="ts">
  import { enhance } from "$app/forms";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();

  let verified = $derived(page.url.searchParams.get("verified") === "true");
  let activated = $derived(page.url.searchParams.get("activated") === "true");
</script>

<svelte:head>
  <title>Log in — VMB</title>
</svelte:head>

<h1>Log in</h1>

{#if verified}
  <p>Your email is verified — you can log in now.</p>
{/if}

{#if activated}
  <p>Your password is set — log in with it now.</p>
{/if}

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

<p>First time here? <a href={resolve("/activate")}>Activate your account</a></p>
