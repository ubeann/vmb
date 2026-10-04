<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import Check from "@lucide/svelte/icons/check";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Mail from "@lucide/svelte/icons/mail";
  import Send from "@lucide/svelte/icons/send";
  import { ActivateRequestInputSchema, ActivateResetInputSchema } from "@vmb/types";
  import AuthCard from "$lib/components/AuthCard.svelte";
  import CodeInput from "$lib/components/CodeInput.svelte";
  import IconInput from "$lib/components/IconInput.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import PageMeta from "$lib/components/PageMeta.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { transitionUpdate } from "$lib/card-transition.js";
  import { SUPPORT_EMAIL } from "$lib/error-page.js";
  import { createFieldValidation, focusFirstInvalidField } from "$lib/field-validation.svelte.js";
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();

  let submitting = $state(false);

  // Shared by every form here: the button reports progress until the action
  // settles. `afterFailure` is where focus goes when the server turns it down,
  // `afterSuccess` what to reset once it has taken it.
  const trackWith =
    (afterFailure: (formElement: HTMLFormElement) => void, afterSuccess?: () => void) =>
    ({ formElement }: { formElement: HTMLFormElement }) => {
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
        await (result.type === "success" && step === "request"
          ? transitionUpdate(update)
          : update());
        submitting = false;
        if (result.type === "failure") afterFailure(formElement);
        else if (result.type === "success") afterSuccess?.();
      };
    };
  const track = trackWith(focusFirstInvalidField);

  // Stops a form whose fields fail the rules before anything is sent (issue #231).
  const checked =
    (validation: { validate: (form: HTMLFormElement) => boolean }, run = track) =>
    ({ formElement, cancel }: { formElement: HTMLFormElement; cancel: () => void }) =>
      validation.validate(formElement) ? run({ formElement }) : cancel();

  // The six boxes hold what was typed until the form is sent.
  let code = $state("");
  let codeInput = $state<HTMLInputElement | null>(null);

  // Whatever the server turned down, the code is typed again: the boxes are
  // emptied and the first one is ready. A mistake in another field goes first.
  function afterCodeFailure(formElement: HTMLFormElement) {
    const invalid = formElement.querySelector<HTMLInputElement>('input[aria-invalid="true"]');
    if (invalid && invalid !== codeInput) {
      invalid.focus();
      return;
    }
    code = "";
    codeInput?.focus();
  }

  // The last digit sends the form, as long as there is a password to send it
  // with; otherwise the password is next. Not while a send is under way: a
  // second one would use up the code.
  function sendOnComplete() {
    const form = codeInput?.form;
    if (!form || submitting) return;
    const password = form.elements.namedItem("password");
    if (password instanceof HTMLInputElement && password.value === "") password.focus();
    else form.requestSubmit();
  }

  // A link inside a sentence keeps the line's height; one on its own line gets
  // a full touch target.
  const inlineLinkClass =
    "text-primary focus-visible:ring-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none";
  const linkClass = `${inlineLinkClass} inline-flex min-h-11 items-center`;

  // "Use a different email" overrides this until the next action result.
  let step = $derived(form && "step" in form && form.step === "reset" ? "reset" : "request");
  let email = $derived(form && "email" in form ? form.email : "");

  // Back to the email step to fix a typo, keeping what was typed. The link's
  // own href does the same, without the email, when JavaScript is off.
  async function useDifferentEmail(event: MouseEvent) {
    event.preventDefault();
    await transitionUpdate(async () => {
      step = "request";
      code = "";
    });
    document.getElementById("email")?.focus();
  }

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
  // A refused code or reset with no field to blame: the error goes under the
  // boxes instead of the banner.
  let codeError = $derived(
    step === "reset" && !serverErrors && form && "errorAt" in form && form.errorAt === "code"
      ? form.error
      : undefined
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
  <!-- The same words whether or not the email belongs to a user: a reply that
       differed would show which emails are registered (#232). -->
  <p class="text-muted-foreground mt-1 text-sm">
    {#if step === "reset"}
      If <strong class="text-foreground">{email}</strong> has VMB access, we sent a code to it. It expires
      in 5 minutes.
    {:else}
      Enter the email associated with your VMB access.
    {/if}
  </p>
  {#if step === "reset"}
    <a href={resolve("/activate")} class="{linkClass} text-sm" onclick={useDifferentEmail}
      >Use a different email</a
    >
  {/if}

  <div class="mt-5 space-y-5">
    {#if form?.error && !codeError && (!fieldErrors || (step === "reset" && fieldErrors.email))}
      <Notice variant="destructive">{form.error}</Notice>
    {/if}

    {#if step === "reset"}
      <form
        method="POST"
        action="?/reset"
        novalidate
        oninput={resetValidation.oninput}
        use:enhance={checked(resetValidation, trackWith(afterCodeFailure))}
        class="space-y-5"
      >
        <input type="hidden" name="email" value={email} />

        <div class="space-y-2">
          <Label for="otp">Code</Label>
          <CodeInput
            id="otp"
            name="otp"
            bind:value={code}
            bind:inputRef={codeInput}
            invalid={!!fieldErrors?.otp}
            aria-describedby={fieldErrors?.otp || codeError ? "otp-hint otp-error" : "otp-hint"}
            onComplete={sendOnComplete}
          />
          <p id="otp-hint" class="text-muted-foreground text-sm">Use the code from your email.</p>
          {#if fieldErrors?.otp || codeError}
            <p id="otp-error" role="alert" class="text-destructive text-sm">
              {fieldErrors?.otp ?? codeError}
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

      <form
        method="POST"
        action="?/resend"
        novalidate
        use:enhance={trackWith(focusFirstInvalidField, () => (code = ""))}
      >
        <input type="hidden" name="email" value={email} />
        <Button
          type="submit"
          variant="outline"
          class="min-h-11 w-full"
          disabled={submitting}
          aria-busy={submitting}>Send a new code</Button
        >
      </form>

      <p class="text-muted-foreground text-sm text-pretty">
        No email after a minute? Check spam, check the address, or contact
        <a href="mailto:{SUPPORT_EMAIL}" class={inlineLinkClass}>{SUPPORT_EMAIL}</a>
      </p>
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
            value={email}
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
