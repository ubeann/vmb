<script lang="ts">
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();
</script>

<h1>Log in</h1>

{#if form?.error}
  <p role="alert">{form.error}</p>
{/if}

<form method="POST">
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

<p>Don't have an account? <a href="/signup">Sign up</a></p>
