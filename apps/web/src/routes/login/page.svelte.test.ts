import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPage: { url: URL } = { url: new URL("http://localhost/login") };

// A stand-in for SvelteKit's `enhance` that keeps its contract: the submit
// callback runs first and `cancel()` stops the request. What would have been
// sent is recorded instead of fetched.
const submissions = vi.hoisted(() => [] as FormData[]);
vi.mock("$app/forms", () => ({
  enhance: (
    form: HTMLFormElement,
    submit?: (input: { formElement: HTMLFormElement; cancel: () => void }) => unknown
  ) => {
    const onSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      let cancelled = false;
      submit?.({ formElement: form, cancel: () => (cancelled = true) });
      if (!cancelled) submissions.push(new FormData(form));
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

  it("confirms sign-out on the login page", async () => {
    mockPage.url = new URL("http://localhost/login?logged_out=true");

    const screen = await render(Page, { form: null });

    await expect.element(screen.getByText(/logged out/i)).toBeVisible();
  });

  it("shows a copyright footer with the current year", async () => {
    mockPage.url = new URL("http://localhost/login");

    const screen = await render(Page, { form: null });

    await expect
      .element(
        screen
          .getByRole("contentinfo")
          .getByText(`© ${new Date().getFullYear()} PT. Vifiera Minova Bersaudara`)
      )
      .toBeVisible();
  });

  it("offers the support team's address and the developer credit in the footer", async () => {
    mockPage.url = new URL("http://localhost/login");

    const screen = await render(Page, { form: null });
    const footer = screen.getByRole("contentinfo");

    await expect
      .element(footer.getByRole("link", { name: "support@vmblogistics.id", exact: true }))
      .toHaveAttribute("href", "mailto:support@vmblogistics.id");
    await expect
      .element(footer.getByRole("link", { name: "ubeann", exact: true }))
      .toHaveAttribute("href", "https://github.com/ubeann");
    expect(footer.element().textContent).toMatch(/Support team:\s+support@vmblogistics\.id/);
  });

  it("renders missing-field errors beside the relevant input", async () => {
    mockPage.url = new URL("http://localhost/login");

    const screen = await render(Page, {
      form: {
        error: "Email and password are required.",
        fieldErrors: { password: "Password is required." }
      }
    });

    await expect.element(screen.getByText("Password is required.")).toBeVisible();
    await expect
      .element(screen.getByLabelText("Password", { exact: true }))
      .toHaveAttribute("aria-invalid", "true");
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
        .element(screen.getByText("Enter a valid email, like name@company.com"))
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
        .element(screen.getByText("Enter a valid email, like name@company.com"))
        .toBeVisible();

      await email.fill("name@company.com");
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
          fieldErrors: { email: "Enter a valid email, like name@company.com" }
        }
      });
      const email = screen.getByLabelText("Email");

      await expect.element(email).toHaveAttribute("aria-invalid", "true");
      // The field message stands in for the banner.
      expect(screen.getByText("Email and password are required.").elements()).toHaveLength(0);

      await email.fill("a@example.com");
      await expect.element(email).not.toHaveAttribute("aria-invalid");
    });
  });
});
