<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import Check from "@lucide/svelte/icons/check";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Mail from "@lucide/svelte/icons/mail";
  import Send from "@lucide/svelte/icons/send";
  import { ActivateRequestInputSchema, ActivateResetInputSchema } from "@vmb/types";
  import AuthCard from "$lib/components/AuthCard.svelte";
  import IconInput from "$lib/components/IconInput.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import PageMeta from "$lib/components/PageMeta.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { transitionUpdate } from "$lib/card-transition.js";
  import { createFieldValidation, focusFirstInvalidField } from "$lib/field-validation.svelte.js";
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();

  let submitting = $state(false);

  // Shared by every form here: the button reports progress until the action settles.
  const track = ({ formElement }: { formElement: HTMLFormElement }) => {
    submitting = true;
    return async ({
      result,
      update
    }: {
      result: { type: string };
      update: () => Promise<void>;
    }) => {
      // A sent code swaps the email step for the code step in the same sheet, so
      // it moves the way a change of page does.
      await (result.type === "success" && step === "request" ? transitionUpdate(update) : update());
      submitting = false;
      if (result.type === "failure") focusFirstInvalidField(formElement);
    };
  };

  // Stops a form whose fields fail the rules before anything is sent (issue #231).
  const checked =
    (validation: { validate: (form: HTMLFormElement) => boolean }) =>
    ({ formElement, cancel }: { formElement: HTMLFormElement; cancel: () => void }) =>
      validation.validate(formElement) ? track({ formElement }) : cancel();

  const linkClass =
    "text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none";

  let step = $derived(form && "step" in form && form.step === "reset" ? "reset" : "request");
  let email = $derived(form && "email" in form ? form.email : "");
  type FieldErrors = Partial<Record<"email" | "otp" | "password", string>>;

  let serverErrors = $derived(
    form && "fieldErrors" in form ? (form.fieldErrors as FieldErrors) : undefined
  );
  // One validation per visible form. The code step's email is a hidden field
  // carried from the request step, so only the server checks it again. "Send a
  // new code" has no visible field to mark, so it has no validation of its own.
  const requestValidation = createFieldValidation(ActivateRequestInputSchema, () => serverErrors);
  const resetValidation = createFieldValidation(
    ActivateResetInputSchema.pick({ otp: true, password: true }),
    () => serverErrors
  );
  let fieldErrors: FieldErrors | undefined = $derived(
    step === "reset" ? resetValidation.errors : requestValidation.errors
  );
</script>

<PageMeta
  title="Set your password"
  description="First time on VMB or forgot your password? Get a one-time code by email and set a new one."
/>

<AuthCard heading="Set your password">
  {#snippet description()}
    First time here or forgot your password? We will email you a one-time code to set a new one.
  {/snippet}

  <h2 class="text-base font-semibold">{step === "reset" ? "Enter your code" : "Get a code"}</h2>
  <p class="text-muted-foreground mt-1 text-sm">
    {#if step === "reset"}
      We sent a code to <strong class="text-foreground">{email}</strong>. It expires in 5 minutes.
    {:else}
      Enter the email associated with your VMB access.
    {/if}
  </p>

  <div class="mt-5 space-y-5">
    {#if form?.error && (!fieldErrors || (step === "reset" && fieldErrors.email))}
      <Notice variant="destructive">{form.error}</Notice>
    {/if}

    {#if step === "reset"}
      <form
        method="POST"
        action="?/reset"
        novalidate
        oninput={resetValidation.oninput}
        use:enhance={checked(resetValidation)}
        class="space-y-5"
      >
        <input type="hidden" name="email" value={email} />

        <div class="space-y-2">
          <Label for="otp">Code</Label>
          <IconInput
            icon={KeyRound}
            class="font-mono tracking-[0.3em] placeholder:tracking-[0.3em]"
            id="otp"
            type="text"
            name="otp"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="123456"
            aria-invalid={fieldErrors?.otp ? "true" : undefined}
            aria-describedby={fieldErrors?.otp ? "otp-hint otp-error" : "otp-hint"}
            required
          />
          <p id="otp-hint" class="text-muted-foreground text-sm">Use the code from your email.</p>
          {#if fieldErrors?.otp}
            <p id="otp-error" role="alert" class="text-destructive text-sm">
              {fieldErrors.otp}
            </p>
          {/if}
        </div>

        <div class="space-y-2">
          <Label for="new-password">New password</Label>
          <PasswordInput
            id="new-password"
            name="password"
            autocomplete="new-password"
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
            Saving…
          {:else}
            <Check class="size-4" aria-hidden="true" />
            Set password
          {/if}
        </Button>
      </form>

      <form method="POST" action="?/request" novalidate use:enhance={track}>
        <input type="hidden" name="email" value={email} />
        <Button
          type="submit"
          variant="outline"
          class="min-h-11 w-full"
          disabled={submitting}
          aria-busy={submitting}>Send a new code</Button
        >
      </form>
    {:else}
      <form
        method="POST"
        action="?/request"
        novalidate
        oninput={requestValidation.oninput}
        use:enhance={checked(requestValidation)}
        class="space-y-5"
      >
        <div class="space-y-2">
          <Label for="email">Email</Label>
          <IconInput
            icon={Mail}
            id="email"
            type="email"
            name="email"
            autocomplete="email"
            placeholder="name@company.com"
            aria-invalid={fieldErrors?.email ? "true" : undefined}
            aria-describedby={fieldErrors?.email ? "email-error" : undefined}
            required
          />
          {#if fieldErrors?.email}
            <p id="email-error" role="alert" class="text-destructive text-sm">
              {fieldErrors.email}
            </p>
          {/if}
        </div>
        <Button type="submit" class="min-h-11 w-full" disabled={submitting} aria-busy={submitting}>
          {#if submitting}
            <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
            Sending…
          {:else}
            <Send class="size-4" aria-hidden="true" />
            Send code
          {/if}
        </Button>
      </form>
    {/if}
  </div>

  {#snippet footer()}
    <a href={resolve("/login")} class={linkClass}>Back to log in</a>
  {/snippet}
</AuthCard>
