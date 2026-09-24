<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();

  let verified = $derived(page.url.searchParams.get("verified") === "true");
  let activated = $derived(page.url.searchParams.get("activated") === "true");
  let loggedOut = $derived(page.url.searchParams.get("logged_out") === "true");
  let fieldErrors = $derived(
    form && "fieldErrors" in form
      ? (form.fieldErrors as Partial<Record<"email" | "password", string>>)
      : undefined
  );
</script>

<svelte:head>
  <title>Log in — VMB</title>
</svelte:head>

<main class="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12">
  <div class="w-full max-w-md space-y-6">
    <div class="space-y-2 text-center">
      <p class="text-primary text-sm font-semibold tracking-widest uppercase">VMB</p>
      <h1 class="text-2xl font-semibold tracking-tight">Log in</h1>
      <p class="text-muted-foreground text-sm">Welcome back. Enter your details to continue.</p>
    </div>

    {#if verified || activated || loggedOut}
      <p role="status" class="bg-muted text-foreground rounded-lg border px-4 py-3 text-sm">
        {#if verified}Your email is verified — you can log in now.{/if}
        {#if activated}Your password is set — log in with it now.{/if}
        {#if loggedOut}You have logged out.{/if}
      </p>
    {/if}

    <Card.Root>
      <Card.Header>
        <Card.Title>Sign in to VMB</Card.Title>
        <Card.Description>Use the email and password for your VMB access.</Card.Description>
      </Card.Header>
      <Card.Content>
        {#if form?.error && !fieldErrors}
          <p
            role="alert"
            class="border-destructive/40 text-destructive mb-4 rounded-lg border p-3 text-sm"
          >
            {form.error}
          </p>
        {/if}

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

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <Label for="password">Password</Label>
              <a
                href={resolve("/activate")}
                class="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >Forgot password?</a
              >
            </div>
            <Input
              class="min-h-11"
              id="password"
              type="password"
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

          <Button type="submit" class="min-h-11 w-full">Log in</Button>
        </form>
      </Card.Content>
    </Card.Root>

    <p class="text-muted-foreground text-center text-sm">
      First time here?
      <a
        href={resolve("/activate")}
        class="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >Activate your account</a
      >
    </p>
  </div>
</main>
