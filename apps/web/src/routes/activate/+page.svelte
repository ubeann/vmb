<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();

  let step = $derived(form && "step" in form && form.step === "reset" ? "reset" : "request");
  let email = $derived(form && "email" in form ? form.email : "");
  let fieldErrors = $derived(
    form && "fieldErrors" in form
      ? (form.fieldErrors as Partial<Record<"email" | "otp" | "password", string>>)
      : undefined
  );
</script>

<svelte:head>
  <title>Set your password — VMB</title>
</svelte:head>

<main class="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12">
  <div class="w-full max-w-md space-y-6">
    <div class="space-y-2 text-center">
      <p class="text-primary text-sm font-semibold tracking-widest uppercase">VMB</p>
      <h1 class="text-2xl font-semibold tracking-tight">Set your password</h1>
      <p class="text-muted-foreground text-sm">
        First time here or forgot your password? We will email you a one-time code to set a new one.
      </p>
    </div>

    <Card.Root>
      <Card.Header>
        <Card.Title>{step === "reset" ? "Enter your code" : "Get a code"}</Card.Title>
        <Card.Description>
          {#if step === "reset"}
            We sent a code to <strong class="text-foreground">{email}</strong>. It expires in 5
            minutes.
          {:else}
            Enter the email associated with your VMB access.
          {/if}
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-5">
        {#if form?.error && (!fieldErrors || (step === "reset" && fieldErrors.email))}
          <p
            role="alert"
            class="border-destructive/40 text-destructive rounded-lg border p-3 text-sm"
          >
            {form.error}
          </p>
        {/if}

        {#if step === "reset"}
          <form method="POST" action="?/reset" use:enhance class="space-y-5">
            <input type="hidden" name="email" value={email} />

            <div class="space-y-2">
              <Label for="otp">Code</Label>
              <Input
                class="min-h-11"
                id="otp"
                type="text"
                name="otp"
                inputmode="numeric"
                autocomplete="one-time-code"
                aria-invalid={fieldErrors?.otp ? "true" : undefined}
                aria-describedby={fieldErrors?.otp ? "otp-hint otp-error" : "otp-hint"}
                required
              />
              <p id="otp-hint" class="text-muted-foreground text-sm">
                Use the code from your email.
              </p>
              {#if fieldErrors?.otp}
                <p id="otp-error" role="alert" class="text-destructive text-sm">
                  {fieldErrors.otp}
                </p>
              {/if}
            </div>

            <div class="space-y-2">
              <Label for="new-password">New password</Label>
              <Input
                class="min-h-11"
                id="new-password"
                type="password"
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

            <Button type="submit" class="min-h-11 w-full">Set password</Button>
          </form>

          <form method="POST" use:enhance>
            <input type="hidden" name="email" value={email} />
            <Button type="submit" variant="outline" class="min-h-11 w-full">Send a new code</Button>
          </form>
        {:else}
          <form method="POST" use:enhance class="space-y-5">
            <div class="space-y-2">
              <Label for="email">Email</Label>
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
              {#if fieldErrors?.email}
                <p id="email-error" role="alert" class="text-destructive text-sm">
                  {fieldErrors.email}
                </p>
              {/if}
            </div>
            <Button type="submit" class="min-h-11 w-full">Send code</Button>
          </form>
        {/if}
      </Card.Content>
    </Card.Root>

    <p class="text-center text-sm">
      <a
        href={resolve("/login")}
        class="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >Back to log in</a
      >
    </p>
  </div>
</main>
