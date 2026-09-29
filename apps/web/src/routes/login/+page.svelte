<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import { LoginInputSchema } from "@vmb/types";
  import AuthShell from "$lib/components/AuthShell.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import PageMeta from "$lib/components/PageMeta.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { createFieldValidation, focusFirstInvalidField } from "$lib/field-validation.svelte.js";
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();

  let submitting = $state(false);

  let verified = $derived(page.url.searchParams.get("verified") === "true");
  let activated = $derived(page.url.searchParams.get("activated") === "true");
  let loggedOut = $derived(page.url.searchParams.get("logged_out") === "true");
  // The browser checks the same rules the action does (issue #231), and shows
  // what the server sent back beside the same fields.
  const validation = createFieldValidation(LoginInputSchema, () =>
    form && "fieldErrors" in form
      ? (form.fieldErrors as Partial<Record<"email" | "password", string>>)
      : undefined
  );
  let fieldErrors = $derived(validation.errors);

  const linkClass =
    "text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none";
</script>

<PageMeta
  title="Log in"
  description="Log in to VMB, where warehouse items, trucking orders and division expenses are kept on record."
/>

<AuthShell heading="Log in">
  {#snippet description()}Use the email and password for your VMB access.{/snippet}

  {#if verified || activated || loggedOut}
    <Notice variant="success" class="mb-5">
      {#if verified}Your email is verified — you can log in now.{/if}
      {#if activated}Your password is set — log in with it now.{/if}
      {#if loggedOut}You have logged out.{/if}
    </Notice>
  {/if}

  {#if form?.error && !fieldErrors}
    <Notice variant="destructive" class="mb-5">{form.error}</Notice>
  {/if}

  <form
    method="POST"
    novalidate
    oninput={validation.oninput}
    use:enhance={({ formElement, cancel }) => {
      if (!validation.validate(formElement)) return cancel();
      submitting = true;
      return async ({ result, update }) => {
        await update();
        submitting = false;
        if (result.type === "failure") focusFirstInvalidField(formElement);
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

    <!-- Unticked by default, as in the legacy login: the session then ends when the browser closes (ADR-0034, #206). The whole row is the 44px target. -->
    <Label class="min-h-11 w-fit cursor-pointer gap-3 font-normal">
      <Checkbox name="rememberMe" />
      Remember me
    </Label>

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
