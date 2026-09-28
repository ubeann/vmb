<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import AuthShell from "$lib/components/AuthShell.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();

  let submitting = $state(false);

  let verified = $derived(page.url.searchParams.get("verified") === "true");
  let activated = $derived(page.url.searchParams.get("activated") === "true");
  let loggedOut = $derived(page.url.searchParams.get("logged_out") === "true");
  let fieldErrors = $derived(
    form && "fieldErrors" in form
      ? (form.fieldErrors as Partial<Record<"email" | "password", string>>)
      : undefined
  );

  const linkClass =
    "text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none";
</script>

<svelte:head>
  <title>Log in — VMB</title>
</svelte:head>

<AuthShell heading="Log in">
  {#snippet description()}Use the email and password for your VMB access.{/snippet}

  {#if verified || activated || loggedOut}
    <p role="status" class="bg-muted mb-5 flex gap-2.5 rounded-md border px-3.5 py-3 text-sm">
      <CircleCheck class="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        {#if verified}Your email is verified — you can log in now.{/if}
        {#if activated}Your password is set — log in with it now.{/if}
        {#if loggedOut}You have logged out.{/if}
      </span>
    </p>
  {/if}

  {#if form?.error && !fieldErrors}
    <p
      role="alert"
      class="border-destructive/40 text-destructive mb-5 flex gap-2.5 rounded-md border px-3.5 py-3 text-sm"
    >
      <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{form.error}</span>
    </p>
  {/if}

  <form
    method="POST"
    use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        await update();
        submitting = false;
      };
    }}
    class="space-y-5"
  >
    <div class="space-y-2">
      <Label for="email">Email</Label>
      <!-- Own wrapper: password-manager extensions insert elements after the input, which would pick up the field's spacing. -->
      <div class="relative">
        <Input
          class="min-h-11"
          id="email"
          type="email"
          name="email"
          autocomplete="email"
          aria-invalid={fieldErrors?.email ? "true" : undefined}
          aria-describedby={fieldErrors?.email ? "email-error" : undefined}
          required
        />
      </div>
      {#if fieldErrors?.email}
        <p id="email-error" role="alert" class="text-destructive text-sm">
          {fieldErrors.email}
        </p>
      {/if}
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between gap-3">
        <Label for="password">Password</Label>
        <a href={resolve("/activate")} class="{linkClass} text-sm">Forgot password?</a>
      </div>
      <PasswordInput
        id="password"
        name="password"
        autocomplete="current-password"
        aria-invalid={fieldErrors?.password ? "true" : undefined}
        aria-describedby={fieldErrors?.password ? "password-error" : undefined}
        required
      />
      {#if fieldErrors?.password}
        <p id="password-error" role="alert" class="text-destructive text-sm">
          {fieldErrors.password}
        </p>
      {/if}
    </div>

    <Button type="submit" class="min-h-11 w-full" disabled={submitting} aria-busy={submitting}>
      {#if submitting}
        <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
        Signing in…
      {:else}
        Log in
      {/if}
    </Button>
  </form>

  {#snippet footer()}
    First time here?
    <a href={resolve("/activate")} class={linkClass}>Activate your account</a>
  {/snippet}
</AuthShell>
