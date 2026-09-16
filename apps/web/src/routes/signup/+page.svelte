<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
  <title>Sign up — VMB</title>
</svelte:head>

<h1>Sign up</h1>

{#if form?.success}
  <p>Check your email to verify your account before logging in.</p>
{:else}
  {#if form?.error}
    <p role="alert">{form.error}</p>
  {/if}

  <form method="POST" use:enhance>
    <label>
      Name
      <input type="text" name="name" autocomplete="name" required />
    </label>

    <label>
      Email
      <input type="email" name="email" autocomplete="email" required />
    </label>

    <label>
      Password
      <input type="password" name="password" autocomplete="new-password" required />
    </label>

    <button type="submit">Sign up</button>
  </form>
{/if}

<p>Already have an account? <a href={resolve("/login")}>Log in</a></p>
