<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Check from "@lucide/svelte/icons/check";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Mail from "@lucide/svelte/icons/mail";
  import PencilLine from "@lucide/svelte/icons/pencil-line";
  import Send from "@lucide/svelte/icons/send";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import {
    ActivatePasswordInputSchema,
    ActivateRequestInputSchema,
    ActivateVerifyInputSchema,
    OTP_LENGTH,
    passwordContextWords
  } from "@vmb/types";
  import { ACTIVATE_ART } from "$lib/activate-art.js";
  import AuthCard from "$lib/components/AuthCard.svelte";
  import CodeInput from "$lib/components/CodeInput.svelte";
  import EtchedMark from "$lib/components/EtchedMark.svelte";
  import IconInput from "$lib/components/IconInput.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import PageMeta from "$lib/components/PageMeta.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import SubmitButton from "$lib/components/SubmitButton.svelte";
  import MovingCheck from "$lib/components/movingicons/check.svelte";
  import { Label } from "$lib/components/ui/label/index.js";
  import { transitionUpdate } from "$lib/card-transition.js";
  import { Countdown, formatClock } from "$lib/countdown.svelte.js";
  import { SUPPORT_EMAIL } from "$lib/error-page.js";
  import { createFieldValidation, focusFirstInvalidField } from "$lib/field-validation.svelte.js";
  import { createSubmission, type Handle } from "$lib/form-submission.svelte.js";
  import {
    PASSWORD_BAR_FULL_AT,
    PASSWORD_MIN_MARK,
    passwordBarFill,
    passwordReading,
    passwordStrength
  } from "$lib/password-strength.js";
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

  // The page's forms, one send at a time; each button shows only its own.
  const submission = createSubmission<"request" | "verify" | "resend" | "restart" | "reset">();

  // How many times an action of the user's has brought a step's mark: a code
  // sent, a code confirmed, a new code sent. The mark is printed in each time,
  // as feedback; a mark that is there on arrival (a reload) is not.
  let printCount = $state(0);

  // What each form does with an action's reply, besides the button reporting
  // progress until it settles. A reply that names another step swaps the steps
  // in the same sheet, so it moves the way a change of page does, and focus
  // goes to the new step's first field. Otherwise `afterFailure` is where focus
  // goes when the server turns the form down, `afterSuccess` what to reset once
  // it has taken it.
  const trackWith =
    (afterFailure = focusFirstInvalidField, afterSuccess?: () => void): Handle =>
    ({ formElement }) =>
    async ({ result, update }) => {
      const from = step;
      const moves =
        "data" in result && result.data?.step !== undefined && result.data.step !== from;
      await (moves
        ? transitionUpdate(async () => {
            await update();
            code = "";
            printCount += 1;
          })
        : update());
      if (step !== from) document.getElementById(firstField[step])?.focus();
      else if (result.type === "failure") afterFailure(formElement);
      else if (result.type === "success") afterSuccess?.();
    };
  const track = trackWith();

  // The six boxes hold what was typed until the form is sent.
  let code = $state("");
  let codeInput = $state<HTMLInputElement | null>(null);

  // Whatever the server turned down, the code is typed again: the boxes are
  // emptied and the first one is ready.
  function afterCodeFailure() {
    code = "";
    codeInput?.focus();
  }

  // When "Send a new code" last worked, said in the step's sentence until the step changes.
  // A derived that is written to, as `password` is below.
  let resentAt: Date | undefined = $derived.by(() => {
    void step;
    return undefined;
  });
  function afterResend() {
    code = "";
    resentAt = new Date();
    printCount += 1;
  }

  // The last digit sends Verify. Not while a send is under way: a second one
  // would count as another try.
  function sendOnComplete() {
    if (!submission.submitting) codeInput?.form?.requestSubmit();
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
  // A new code is announced whether or not a wait follows it.
  let resendStatus = $derived.by(() => {
    if (step !== "code") return "";
    const sent = resentAt ? "A new code is on its way. " : "";
    if (resendWait.remaining === 0)
      return resendWait.finished ? `${sent}You can send a new code now.` : sent.trim();
    return resendWait.total === 1
      ? `${sent}You can send a new code in 1 second.`
      : `${sent}You can send a new code in ${resendWait.total} seconds.`;
  });

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
  // The reading under the new-password field follows what is typed (ADR-0041).
  // It only reads the field; the schema still decides on submit, and so does
  // the server for the words about the account.
  //
  // The password form is mounted again, blank, each time the step is reached, so
  // what was typed goes when the step changes: kept, it would describe a field
  // that is empty (a code that expired sends the user back to the code step). A
  // derived that is written to, and starts over when the step changes.
  let password = $derived.by(() => {
    void step;
    return "";
  });
  let passwordLength = $derived(password.length);
  let strength = $derived(passwordStrength(passwordLength));
  // The email is the user's own, so naming the word to leave out reveals nothing.
  let contextWords = $derived(passwordContextWords(password, email));
  // A word to leave out stops the form in the browser, with the field marked
  // and focused; the server refuses it too (ADR-0041).
  const passwordCheck = {
    validate(form: HTMLFormElement) {
      if (contextWords.length) {
        document.getElementById("new-password")?.focus();
        return false;
      }
      return passwordValidation.validate(form);
    }
  };
  function onPasswordFormInput(event: Event) {
    passwordValidation.oninput(event);
    if (event.target instanceof HTMLInputElement && event.target.name === "password") {
      password = event.target.value;
    }
  }
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

  // The email step's heading is the page's own ("Set your password").
  const headings: Record<Exclude<Step, "request">, string> = {
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

<!-- The same words whether or not the email belongs to a user: a reply that
     differed would show which emails are registered (#232). It is read with
     the step's field, so a screen reader hears where the code went and that it
     was confirmed, not just the field's name. -->
{#snippet status()}
  <span id="step-status">
    {#if step === "password"}
      <!-- Status only: the advice for the password sits with its field. The
           check keeps its own column, so a long email wraps under the text. -->
      <span class="flex items-start gap-2">
        <MovingCheck animate={printCount > 0} size={16} class="text-primary mt-0.5 shrink-0" />
        <span class="min-w-0 break-words"
          >Code confirmed for <strong class="text-foreground">{email}</strong>.</span
        >
      </span>
    {:else if resentAt}
      If <strong class="text-foreground">{email}</strong> has VMB access, we sent a new code to it
      at
      <time class="whitespace-nowrap" datetime={resentAt.toISOString()}
        >{resentAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time
      >. It expires in 5 minutes.
    {:else}
      If <strong class="text-foreground">{email}</strong> has VMB access, we sent a code to it. It expires
      in 5 minutes.
    {/if}
  </span>
{/snippet}

<!-- The code and password steps are each about one thing, so their heading is
     the step's own, and their status takes the place of the page's intro,
     which explains the email step (#273, #256). The folio under the heading
     says where in the three steps the page is (ADR-0046). -->
<AuthCard
  heading={step === "request" ? "Set your password" : headings[step]}
  description={step === "request" ? intro : status}
  step={{ at: STEPS.indexOf(step) + 1, of: STEPS.length }}
>
  {#if step === "request"}
    <p class="text-muted-foreground text-sm text-pretty">
      Enter the email associated with your VMB access.
    </p>
  {/if}

  <div class={["space-y-5", step === "request" && "mt-5"]}>
    {#if form?.error && !codeError && (!fieldErrors || (step === "code" && fieldErrors.email))}
      <Notice variant="destructive">{form.error}</Notice>
    {/if}

    {#if step === "password"}
      <form
        method="POST"
        action="?/reset"
        novalidate
        oninput={onPasswordFormInput}
        use:enhance={submission.enhance(passwordCheck, track, "reset")}
        class="space-y-5"
      >
        <!-- Tells a password manager which email the new password is saved
             under. It has no name, so it is not sent. -->
        <input type="email" autocomplete="username" value={email} hidden readonly />

        <!-- Etched art, as on the code step: its own band, in the flow with a
             fixed ratio. -->
        <EtchedMark art={ACTIVATE_ART.padlock} reveal={printCount > 0} class="mx-auto w-20" />

        <div class="space-y-2">
          <Label for="new-password">New password</Label>
          <PasswordInput
            id="new-password"
            name="password"
            autocomplete="new-password"
            aria-invalid={fieldErrors?.password || contextWords.length ? "true" : undefined}
            aria-describedby={fieldErrors?.password
              ? "password-error step-status password-rules password-context"
              : "step-status password-rules password-context"}
            required
          />
          {#if fieldErrors?.password}
            <p id="password-error" role="alert" class="text-destructive text-sm">
              {fieldErrors.password}
            </p>
          {/if}
          <div id="password-rules" class="space-y-2 pt-1 text-sm">
            <!-- One bar for the length rule and the advice: the tick is the
                 minimum, and past it the fill goes on to the full mark. Text
                 says the same, so colour is not the only cue. Advice only: the
                 schema is what blocks. -->
            <div
              role="meter"
              aria-label="Password length"
              aria-valuemin={0}
              aria-valuemax={PASSWORD_BAR_FULL_AT}
              aria-valuenow={Math.min(passwordLength, PASSWORD_BAR_FULL_AT)}
              aria-valuetext={passwordReading(passwordLength)}
              data-password-strength={strength ?? "none"}
              class="bg-border relative h-1.5 overflow-hidden rounded-full"
            >
              <div
                class={[
                  "h-full transition-[clip-path,background-color] duration-(--duration-feedback) ease-(--easing-standard) motion-reduce:transition-none",
                  strength ? "bg-primary" : "bg-muted-foreground"
                ]}
                style="clip-path: inset(0 {100 -
                  passwordBarFill(passwordLength) * 100}% 0 0 round 9999px)"
              ></div>
              <div
                class="bg-card absolute inset-y-0 w-0.5"
                style="left: {PASSWORD_MIN_MARK * 100}%"
              ></div>
            </div>
            <p class={strength ? "text-foreground" : "text-muted-foreground"}>
              {passwordReading(passwordLength)}
            </p>
            <!-- The advice and a word to leave out share one line: the warning
                 takes the advice's place, so the line is never empty and
                 nothing under it moves. Hidden, the advice drops out of the
                 field's description too. Only the warning is announced. -->
            <div class="grid">
              <p
                class="text-muted-foreground col-start-1 row-start-1 text-pretty"
                style:visibility={contextWords.length ? "hidden" : undefined}
              >
                Three or four words work well, and spaces are fine.
              </p>
              <p
                id="password-context"
                class="text-destructive col-start-1 row-start-1"
                aria-live="polite"
              >
                {#if contextWords.length}
                  Leave {contextWords.map((word) => `"${word}"`).join(" and ")} out of your password
                {/if}
              </p>
            </div>
          </div>
        </div>

        <SubmitButton
          icon={Check}
          pending={submission.pending === "reset"}
          slow={submission.slow}
          pendingLabel="Saving…">Set password</SubmitButton
        >
      </form>
    {:else if step === "code"}
      <form
        method="POST"
        action="?/verify"
        novalidate
        oninput={verifyValidation.oninput}
        use:enhance={submission.enhance(verifyValidation, trackWith(afterCodeFailure), "verify")}
        class="space-y-5"
      >
        <input type="hidden" name="email" value={email} />

        <!-- Etched art (#273): its own band above the boxes, in the flow with a
             fixed ratio, so nothing moves when the mask loads. -->
        <!-- Printed again for each new code sent. -->
        {#key printCount}
          <EtchedMark art={ACTIVATE_ART.slip} reveal={printCount > 0} class="mx-auto w-28" />
        {/key}

        <div class="space-y-2">
          <Label for="otp">Code</Label>
          <CodeInput
            id="otp"
            name="otp"
            bind:value={code}
            bind:inputRef={codeInput}
            invalid={!!fieldErrors?.otp}
            aria-describedby={fieldErrors?.otp || codeError ? "otp-error" : "step-status otp-hint"}
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

        <SubmitButton
          icon={ShieldCheck}
          pending={submission.pending === "verify"}
          slow={submission.slow}
          pendingLabel="Verifying…">Verify code</SubmitButton
        >
      </form>

      <form
        method="POST"
        action="?/resend"
        novalidate
        use:enhance={submission.enhance(undefined, trackWith(undefined, afterResend), "resend")}
      >
        <input type="hidden" name="email" value={email} />
        <!-- The wait is in the label, read at full opacity in the muted ink
             rather than faded like other disabled buttons, so it stays legible
             outdoors. The time is hidden from the button's name: screen readers
             get the wait from the status region below, which changes when it
             starts and ends, not every second. When the last code went out is
             in the step's sentence above. -->
        <SubmitButton
          variant="outline"
          class="disabled:text-muted-foreground disabled:opacity-100"
          pending={submission.pending === "resend"}
          slow={submission.slow}
          pendingLabel="Sending…"
          disabled={resendWait.remaining > 0}
        >
          <!-- One span, so the button's flex gap doesn't widen the space before "in". -->
          <span
            >Send a new code{#if resendWait.remaining > 0}<span aria-hidden="true"
                >&nbsp;in <span class="font-mono tabular-nums"
                  >{formatClock(resendWait.remaining)}</span
                ></span
              >{/if}</span
          >
        </SubmitButton>
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
        use:enhance={submission.enhance(requestValidation, track, "request")}
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
        <SubmitButton
          icon={Send}
          pending={submission.pending === "request"}
          slow={submission.slow}
          pendingLabel="Sending…">Send code</SubmitButton
        >
      </form>
    {/if}
    <p role="status" class="sr-only">{resendStatus}</p>
  </div>

  <!-- Starting over sits with leaving, under the rule: both step out of the
       task, and neither should sit between the step's status and its field.
       "Back to log in" keeps the left on every step, its arrow pointing the
       way it goes; the pencil says "change what you typed". -->
  {#snippet footer()}
    <div class="flex flex-wrap items-center justify-between gap-x-6">
      <a href={resolve("/login")} class="{linkClass} gap-1.5">
        <ArrowLeft class="size-4" aria-hidden="true" />Back to log in
      </a>
      {#if step !== "request"}
        <!-- A form, not a link: starting over drops the sent or checked code,
             which only the server can reach, and it works without JavaScript.
             It still looks like a link; the base layer's bordered button would
             read as a second Set password. -->
        <form
          method="POST"
          action="?/restart"
          novalidate
          use:enhance={submission.enhance(undefined, track, "restart")}
        >
          <!-- For a page left open past the cookies' life, which hold the email too. -->
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            class="{linkClass} gap-1.5 border-0 bg-transparent p-0"
            aria-busy={submission.pending === "restart"}
          >
            {#if submission.pending === "restart"}
              <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
            {:else}
              <PencilLine class="size-4" aria-hidden="true" />
            {/if}
            Use a different email
          </button>
        </form>
      {/if}
    </div>
  {/snippet}
</AuthCard>
