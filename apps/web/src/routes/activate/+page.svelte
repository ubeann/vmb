<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();

  let step = $derived(form && "step" in form && form.step === "reset" ? "reset" : "request");
  let email = $derived(form && "email" in form ? form.email : "");
</script>

<svelte:head>
  <title>Activate your account — VMB</title>
</svelte:head>

<h1>Activate your account</h1>

<p>
  VMB has moved to a new platform. Confirm your email with a one-time code, then set your password.
</p>

{#if form?.error}
  <p role="alert">{form.error}</p>
{/if}

{#if step === "reset"}
  <p>We sent a code to <strong>{email}</strong>. It expires in 5 minutes.</p>

  <form method="POST" action="?/reset" use:enhance>
    <input type="hidden" name="email" value={email} />

    <label>
      Code
      <input type="text" name="otp" inputmode="numeric" autocomplete="one-time-code" required />
    </label>

    <label>
      New password
      <input type="password" name="password" autocomplete="new-password" required />
    </label>

    <button type="submit">Set password</button>
  </form>

  <form method="POST" use:enhance>
    <input type="hidden" name="email" value={email} />
    <button type="submit">Send a new code</button>
  </form>
{:else}
  <form method="POST" use:enhance>
    <label>
      Email
      <input type="email" name="email" autocomplete="email" required />
    </label>

    <button type="submit">Send code</button>
  </form>
{/if}

<p><a href={resolve("/login")}>Back to log in</a></p>
