<script lang="ts">
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();
</script>

<h1>Sign up</h1>

{#if form?.error}
  <p role="alert">{form.error}</p>
{/if}

<form method="POST">
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

<p>Already have an account? <a href="/login">Log in</a></p>
