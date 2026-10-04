<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import Check from "@lucide/svelte/icons/check";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Mail from "@lucide/svelte/icons/mail";
  import Send from "@lucide/svelte/icons/send";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import {
    ActivatePasswordInputSchema,
    ActivateRequestInputSchema,
    ActivateVerifyInputSchema,
    OTP_LENGTH,
    PASSWORD_MIN_LENGTH
  } from "@vmb/types";
  import { ACTIVATE_ART } from "$lib/activate-art.js";
  import AuthCard from "$lib/components/AuthCard.svelte";
  import CodeInput from "$lib/components/CodeInput.svelte";
  import EtchedMark from "$lib/components/EtchedMark.svelte";
  import IconInput from "$lib/components/IconInput.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import PageMeta from "$lib/components/PageMeta.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { transitionUpdate } from "$lib/card-transition.js";
  import { Countdown, formatClock } from "$lib/countdown.svelte.js";
  import { SUPPORT_EMAIL } from "$lib/error-page.js";
  import { createFieldValidation, focusFirstInvalidField } from "$lib/field-validation.svelte.js";
  import type { ActionData, PageData } from "./$types.js";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Three steps on one route (#254): the email, the code, the new password.
  const STEPS = ["request", "code", "password"] as const;
  type Step = (typeof STEPS)[number];

  // An action's reply names the step it leaves the page on. Without one, the
  // load's step stands: the password step while a checked code is kept, the
  // code step while the code just sent is still good.
  let step: Step = $derived(
    STEPS.find((name) => form && "step" in form && form.step === name) ?? data.step ?? "request"
  );
  let email = $derived(
    form && "email" in form && typeof form.email === "string" ? form.email : (data.email ?? "")
  );

  // Where focus goes when a step comes in: its first field.
  const firstField: Record<Step, string> = {
    request: "email",
    code: "otp",
    password: "new-password"
  };

  let submitting = $state(false);

  // Shared by every form here: the button reports progress until the action
  // settles. A reply that names another step swaps the steps in the same
  // sheet, so it moves the way a change of page does, and focus goes to the
  // new step's first field. Otherwise `afterFailure` is where focus goes when
  // the server turns the form down, `afterSuccess` what to reset once it has
  // taken it.
  const trackWith =
    (afterFailure: (formElement: HTMLFormElement) => void, afterSuccess?: () => void) =>
    ({ formElement }: { formElement: HTMLFormElement }) => {
      submitting = true;
      return async ({
        result,
        update
      }: {
        result: { type: string; data?: Record<string, unknown> };
        update: () => Promise<void>;
      }) => {
        const from = step;
        const moves = result.data?.step !== undefined && result.data.step !== from;
        await (moves
          ? transitionUpdate(async () => {
              await update();
              code = "";
            })
          : update());
        submitting = false;
        if (step !== from) document.getElementById(firstField[step])?.focus();
        else if (result.type === "failure") afterFailure(formElement);
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
  // emptied and the first one is ready.
  function afterCodeFailure() {
    code = "";
    codeInput?.focus();
  }

  // The last digit sends Verify. Not while a send is under way: a second one
  // would count as another try.
  function sendOnComplete() {
    if (!submitting) codeInput?.form?.requestSubmit();
  }

  // The wait before "Send a new code" is back (#255). The load works out the
  // seconds left from the send time the server kept, so a reload keeps them.
  // The send time also changes with each code sent, so a new code starts the
  // count again even when the seconds left are the same as before. It runs in
  // the browser only: the page is sent with the button ready, so without
  // JavaScript it can still be pressed. The server's limits are the gate, not
  // this (ADR-0042).
  const resendWait = new Countdown();
  $effect(() => {
    void data.sentAt;
    resendWait.start(data.resendIn ?? 0);
    return () => resendWait.stop();
  });
  // Said to screen readers, politely, in a status region that is always on the
  // page so a change is announced. It is built from the length of the wait,
  // not the time left, so it changes when the wait starts and when it ends,
  // not every second.
  function resendMessage() {
    if (step !== "code") return "";
    if (resendWait.remaining === 0)
      return resendWait.finished ? "You can send a new code now." : "";
    return resendWait.total === 1
      ? "You can send a new code in 1 second."
      : `You can send a new code in ${resendWait.total} seconds.`;
  }
  let resendStatus = $derived(resendMessage());

  // A link inside a sentence keeps the line's height; one on its own line gets
  // a full touch target.
  const inlineLinkClass =
    "text-primary focus-visible:ring-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none";
  const linkClass = `${inlineLinkClass} inline-flex min-h-11 items-center`;

  type FieldErrors = Partial<Record<"email" | "otp" | "password", string>>;

  let serverErrors = $derived(
    form && "fieldErrors" in form ? (form.fieldErrors as FieldErrors) : undefined
  );
  // One validation per step's form. The code step's email is a hidden field
  // carried from the email step, so only the server checks it again. "Send a
  // new code" has no visible field to mark, so it has no validation of its own.
  const requestValidation = createFieldValidation(ActivateRequestInputSchema, () => serverErrors);
  const verifyValidation = createFieldValidation(
    ActivateVerifyInputSchema.pick({ otp: true }),
    () => serverErrors
  );
  const passwordValidation = createFieldValidation(ActivatePasswordInputSchema, () => serverErrors);
  // A refused code with no field to blame: the error goes under the boxes
  // instead of the banner.
  let codeError = $derived(
    step === "code" && !serverErrors && form && "errorAt" in form && form.errorAt === "code"
      ? form.error
      : undefined
  );
  let fieldErrors: FieldErrors | undefined = $derived(
    {
      request: requestValidation.errors,
      code: verifyValidation.errors,
      password: passwordValidation.errors
    }[step]
  );

  const headings: Record<Step, string> = {
    request: "Get a code",
    code: "Enter your code",
    password: "Choose a new password"
  };
</script>

<PageMeta
  title="Set your password"
  description="First time on VMB or forgot your password? Get a one-time code by email and set a new one."
/>

{#snippet intro()}
  First time here or forgot your password? We will email you a one-time code to set a new one.
{/snippet}

<!-- The code step is about one thing, so its heading is the step's own and the
     page's intro, which explains the email step, steps aside (#273). -->
<AuthCard
  heading={step === "code" ? headings.code : "Set your password"}
  description={step === "code" ? undefined : intro}
>
  {#if step !== "code"}
    <h2 class="text-base font-semibold">{headings[step]}</h2>
  {/if}
  <!-- The same words whether or not the email belongs to a user: a reply that
       differed would show which emails are registered (#232). -->
  <p class="text-muted-foreground mt-1 text-sm text-pretty">
    {#if step === "password"}
      Code confirmed. Choose a password for <strong class="text-foreground">{email}</strong>.
    {:else if step === "code"}
      If <strong class="text-foreground">{email}</strong> has VMB access, we sent a code to it. It expires
      in 5 minutes.
    {:else}
      Enter the email associated with your VMB access.
    {/if}
  </p>
  {#if step !== "request"}
    <!-- A form, not a link: starting over drops the sent or checked code, which
         only the server can reach, and it works without JavaScript. It still
         looks like a link; the base layer's bordered button would read as a
         second Set password. -->
    <form method="POST" action="?/restart" novalidate use:enhance={track}>
      <!-- For a page left open past the cookies' life, which hold the email too. -->
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        class="{linkClass} border-0 bg-transparent p-0 text-sm"
        disabled={submitting}>Use a different email</button
      >
    </form>
  {/if}

  <div class="mt-5 space-y-5">
    {#if form?.error && !codeError && (!fieldErrors || (step === "code" && fieldErrors.email))}
      <Notice variant="destructive">{form.error}</Notice>
    {/if}

    {#if step === "password"}
      <form
        method="POST"
        action="?/reset"
        novalidate
        oninput={passwordValidation.oninput}
        use:enhance={checked(passwordValidation)}
        class="space-y-5"
      >
        <!-- Tells a password manager which email the new password is saved
             under. It has no name, so it is not sent. -->
        <input type="email" autocomplete="username" value={email} hidden readonly />

        <div class="space-y-2">
          <Label for="new-password">New password</Label>
          <PasswordInput
            id="new-password"
            name="password"
            autocomplete="new-password"
            aria-invalid={fieldErrors?.password ? "true" : undefined}
            aria-describedby={fieldErrors?.password ? "password-error" : "password-hint"}
            required
          />
          {#if fieldErrors?.password}
            <p id="password-error" role="alert" class="text-destructive text-sm">
              {fieldErrors.password}
            </p>
          {:else}
            <p id="password-hint" class="text-muted-foreground text-sm">
              Use at least {PASSWORD_MIN_LENGTH} characters.
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
    {:else if step === "code"}
      <form
        method="POST"
        action="?/verify"
        novalidate
        oninput={verifyValidation.oninput}
        use:enhance={checked(verifyValidation, trackWith(afterCodeFailure))}
        class="space-y-5"
      >
        <input type="hidden" name="email" value={email} />

        <!-- Etched art (#273): its own band above the boxes, in the flow with a
             fixed ratio, so nothing moves when the mask loads. -->
        <EtchedMark art={ACTIVATE_ART.slip} class="mx-auto w-28" />

        <div class="space-y-2">
          <Label for="otp">Code</Label>
          <CodeInput
            id="otp"
            name="otp"
            bind:value={code}
            bind:inputRef={codeInput}
            invalid={!!fieldErrors?.otp}
            aria-describedby={fieldErrors?.otp || codeError ? "otp-error" : "otp-hint"}
            onComplete={sendOnComplete}
          />
          <!-- An error takes the hint's place, as the password field's does. -->
          {#if fieldErrors?.otp || codeError}
            <p id="otp-error" role="alert" class="text-destructive text-sm">
              {fieldErrors?.otp ?? codeError}
            </p>
          {:else}
            <p id="otp-hint" class="text-muted-foreground text-sm">
              Enter the {OTP_LENGTH}-digit code from your email.
            </p>
          {/if}
        </div>

        <Button type="submit" class="min-h-11 w-full" disabled={submitting} aria-busy={submitting}>
          {#if submitting}
            <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
            Verifying…
          {:else}
            <ShieldCheck class="size-4" aria-hidden="true" />
            Verify code
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
          disabled={submitting || resendWait.remaining > 0}
          aria-busy={submitting}
        >
          Send a new code{#if resendWait.remaining > 0}<span aria-hidden="true"
              >&nbsp;in {formatClock(resendWait.remaining)}</span
            >{/if}
        </Button>
      </form>

      <p class="text-muted-foreground text-sm text-pretty">
        No email after a minute? Check your spam folder and the address, or contact
        <a href="mailto:{SUPPORT_EMAIL}" class={inlineLinkClass}>{SUPPORT_EMAIL}</a>.
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
            placeholder="name@example.com"
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
    <p role="status" class="sr-only">{resendStatus}</p>
  </div>

  {#snippet footer()}
    <a href={resolve("/login")} class={linkClass}>Back to log in</a>
  {/snippet}
</AuthCard>
