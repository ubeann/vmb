import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPage: { url: URL } = { url: new URL("http://localhost/login") };

// A stand-in for SvelteKit's `enhance` that keeps its contract: the submit
// callback runs first and `cancel()` stops the request. What would have been
// sent is recorded instead of fetched.
const submissions = vi.hoisted(() => [] as FormData[]);
const completions = vi.hoisted(
  () =>
    [] as Array<
      (options: { result: { type: "failure" }; update: () => Promise<void> }) => Promise<void>
    >
);
vi.mock("$app/forms", () => ({
  enhance: (
    form: HTMLFormElement,
    submit?: (input: {
      formElement: HTMLFormElement;
      cancel: () => void;
    }) =>
      | void
      | ((options: { result: { type: "failure" }; update: () => Promise<void> }) => Promise<void>)
  ) => {
    const onSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      let cancelled = false;
      const complete = submit?.({ formElement: form, cancel: () => (cancelled = true) });
      if (!cancelled) {
        submissions.push(new FormData(form));
        if (complete) completions.push(complete);
      }
    };
    form.addEventListener("submit", onSubmit);
    return { destroy: () => form.removeEventListener("submit", onSubmit) };
  }
}));
vi.mock("$app/paths", () => ({
  resolve: (path: string) => path
}));
vi.mock("$app/state", () => ({
  page: mockPage
}));

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

beforeEach(() => {
  submissions.length = 0;
  completions.length = 0;
});

describe("login page", () => {
  it("renders the email/password form with no error or verified banner by default", async () => {
    mockPage.url = new URL("http://localhost/login");

    const screen = await render(Page, { form: null });

    await expect.element(screen.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect.element(screen.getByLabelText("Email")).toBeVisible();
    await expect.element(screen.getByLabelText("Password", { exact: true })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Log in" })).toBeVisible();
    expect(screen.getByRole("alert").elements()).toHaveLength(0);
    expect(screen.getByText(/verified/i).elements()).toHaveLength(0);
  });

  it("shows the server action's error message", async () => {
    mockPage.url = new URL("http://localhost/login");

    const screen = await render(Page, { form: { error: "Invalid email or password." } });

    await expect.element(screen.getByRole("alert")).toHaveTextContent("Invalid email or password.");
  });

  it("shows a verified banner when arriving via ?verified=true", async () => {
    mockPage.url = new URL("http://localhost/login?verified=true");

    const screen = await render(Page, { form: null });

    await expect.element(screen.getByText(/verified/i)).toBeVisible();
    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent("Your email is verified — you can log in now.");
    expect(screen.getByRole("alert").elements()).toHaveLength(0);
  });

  it("announces the logged-out notice as a status", async () => {
    mockPage.url = new URL("http://localhost/login?logged_out=true");

    const screen = await render(Page, { form: null });

    await expect.element(screen.getByRole("status")).toHaveTextContent("You have logged out.");
  });

  // Arriving from /activate focuses the heading; a filled status region is often not read.
  it("reads the arrival notice with the heading", async () => {
    mockPage.url = new URL("http://localhost/login?activated=true");

    const screen = await render(Page, { form: null });

    await expect
      .element(screen.getByRole("heading", { name: "Log in" }))
      .toHaveAccessibleDescription(/password is set/i);
  });

  it("shows an activated banner when arriving via ?activated=true", async () => {
    mockPage.url = new URL("http://localhost/login?activated=true");

    const screen = await render(Page, { form: null });

    await expect.element(screen.getByText(/password is set/i)).toBeVisible();
  });

  it("links to the activation page for first-time users", async () => {
    mockPage.url = new URL("http://localhost/login");

    const screen = await render(Page, { form: null });

    await expect.element(screen.getByRole("link", { name: "Activate your account" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Forgot password?" })).toBeVisible();
  });

  // #206: unticked by default, as in the legacy Filament login. The action
  // reads the field's presence, so what matters is what the form submits.
  it("offers Remember me, unticked by default and submitted only once ticked", async () => {
    mockPage.url = new URL("http://localhost/login");

    const screen = await render(Page, { form: null });
    const rememberMe = screen.getByRole("checkbox", { name: "Remember me" });
    const form = screen.container.querySelector("form")!;

    await expect.element(rememberMe).not.toBeChecked();
    expect(new FormData(form).has("rememberMe")).toBe(false);

    await screen.getByText("Remember me").click();

    await expect.element(rememberMe).toBeChecked();
    expect(new FormData(form).has("rememberMe")).toBe(true);
  });

  describe("inline validation (#231)", () => {
    const stay = () => {
      mockPage.url = new URL("http://localhost/login");
    };

    it("turns the browser's own validation off", async () => {
      stay();

      const screen = await render(Page, { form: null });

      expect(screen.container.querySelector("form")!.noValidate).toBe(true);
      await expect.element(screen.getByLabelText("Email")).toBeRequired();
      await expect.element(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
      await expect.element(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    });

    it("marks empty fields on submit, links each message, and sends nothing", async () => {
      stay();
      const screen = await render(Page, { form: null });
      const email = screen.getByLabelText("Email");
      const password = screen.getByLabelText("Password", { exact: true });

      await screen.getByRole("button", { name: "Log in" }).click();

      await expect.element(screen.getByText("Enter your email")).toBeVisible();
      await expect.element(screen.getByText("Enter your password")).toBeVisible();
      await expect.element(email).toHaveAttribute("aria-invalid", "true");
      await expect.element(email).toHaveAttribute("aria-describedby", "email-error");
      await expect.element(password).toHaveAttribute("aria-invalid", "true");
      await expect.element(password).toHaveAttribute("aria-describedby", "password-error");
      expect(submissions).toHaveLength(0);
    });

    it("moves focus to the first invalid field", async () => {
      stay();
      const screen = await render(Page, { form: null });

      await screen.getByRole("button", { name: "Log in" }).click();
      await expect.element(screen.getByLabelText("Email")).toHaveFocus();

      await screen.getByLabelText("Email").fill("a@example.com");
      await screen.getByRole("button", { name: "Log in" }).click();
      await expect.element(screen.getByLabelText("Password", { exact: true })).toHaveFocus();
    });

    it("asks for a well-formed email", async () => {
      stay();
      const screen = await render(Page, { form: null });

      await screen.getByLabelText("Email").fill("name@");
      await screen.getByLabelText("Password", { exact: true }).fill("secret");
      await screen.getByRole("button", { name: "Log in" }).click();

      await expect
        .element(screen.getByText("Enter a valid email, like name@example.com"))
        .toBeVisible();
      expect(submissions).toHaveLength(0);
    });

    it("checks a marked field again as the user types, and leaves the others alone", async () => {
      stay();
      const screen = await render(Page, { form: null });
      const email = screen.getByLabelText("Email");
      await screen.getByRole("button", { name: "Log in" }).click();

      await email.fill("name@");
      await expect
        .element(screen.getByText("Enter a valid email, like name@example.com"))
        .toBeVisible();

      await email.fill("name@example.com");
      expect(screen.getByText(/Enter (your|a valid) email/).elements()).toHaveLength(0);
      await expect.element(email).not.toHaveAttribute("aria-invalid");
      await expect.element(email).not.toHaveAttribute("aria-describedby");
      // Still marked: it was invalid at submit and has not been edited.
      await expect.element(screen.getByText("Enter your password")).toBeVisible();
    });

    it("does not mark a field the user has not submitted yet", async () => {
      stay();
      const screen = await render(Page, { form: null });

      await screen.getByLabelText("Email").fill("name@");

      expect(screen.getByRole("alert").elements()).toHaveLength(0);
    });

    it("sends the form once every field passes", async () => {
      stay();
      const screen = await render(Page, { form: null });

      await screen.getByLabelText("Email").fill("a@example.com");
      await screen.getByLabelText("Password", { exact: true }).fill("x");
      await screen.getByRole("button", { name: "Log in" }).click();

      expect(submissions).toHaveLength(1);
      expect(submissions[0]!.get("email")).toBe("a@example.com");
      expect(submissions[0]!.get("password")).toBe("x");
      expect(screen.getByRole("alert").elements()).toHaveLength(0);
    });

    it("marks the field a server response names, and clears it once fixed", async () => {
      stay();
      const screen = await render(Page, {
        form: {
          error: "Email and password are required.",
          fieldErrors: { email: "Enter a valid email, like name@example.com" }
        }
      });
      const email = screen.getByLabelText("Email");

      await expect.element(email).toHaveAttribute("aria-invalid", "true");
      // The field message stands in for the banner.
      expect(screen.getByText("Email and password are required.").elements()).toHaveLength(0);

      await email.fill("a@example.com");
      await expect.element(email).not.toHaveAttribute("aria-invalid");
    });

    it("focuses a field rejected by the server after the enhanced submit", async () => {
      stay();
      const screen = await render(Page, { form: null });
      await screen.getByLabelText("Email").fill("a@example.com");
      await screen.getByLabelText("Password", { exact: true }).fill("secret");
      await screen.getByRole("button", { name: "Log in" }).click();

      expect(submissions).toHaveLength(1);
      await completions[0]!({
        result: { type: "failure" },
        update: () =>
          screen.rerender({
            form: {
              error: "Enter a valid email, like name@example.com",
              fieldErrors: { email: "Enter a valid email, like name@example.com" }
            }
          })
      });

      await expect.element(screen.getByLabelText("Email")).toHaveFocus();
    });
  });

  describe("field icons and hints (#234)", () => {
    const decorativeIcons = (element: Element) =>
      [...element.querySelectorAll("svg")].filter(
        (icon) => icon.getAttribute("aria-hidden") === "true"
      );

    it("shows the email format as a hint, and gives the password none", async () => {
      mockPage.url = new URL("http://localhost/login");

      const screen = await render(Page, { form: null });

      await expect
        .element(screen.getByLabelText("Email"))
        .toHaveAttribute("placeholder", "name@example.com");
      expect(
        screen.getByLabelText("Password", { exact: true }).element().hasAttribute("placeholder")
      ).toBe(false);
    });

    it("draws a decorative icon in each field and on the button", async () => {
      mockPage.url = new URL("http://localhost/login");

      const screen = await render(Page, { form: null });

      for (const field of [
        screen.getByLabelText("Email").element(),
        screen.getByLabelText("Password", { exact: true }).element()
      ]) {
        expect(decorativeIcons(field.parentElement!)).not.toHaveLength(0);
      }
      expect(
        decorativeIcons(screen.getByRole("button", { name: "Log in" }).element())
      ).toHaveLength(1);
    });

    it("keeps the words on the button while signing in", async () => {
      mockPage.url = new URL("http://localhost/login");

      const screen = await render(Page, { form: null });
      await screen.getByLabelText("Email").fill("a@example.com");
      await screen.getByLabelText("Password", { exact: true }).fill("longenough");
      await screen.getByRole("button", { name: "Log in" }).click();

      await expect
        .element(screen.getByRole("button", { name: "Signing in…" }))
        .toHaveAttribute("aria-busy", "true");
    });
  });
});
