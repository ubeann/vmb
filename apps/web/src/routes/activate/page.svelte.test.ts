import { beforeEach, describe, expect, it, vi } from "vitest";

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
  page: { url: new URL("http://localhost/activate") }
}));

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

beforeEach(() => {
  submissions.length = 0;
  completions.length = 0;
});

describe("activate page", () => {
  it("asks for the email first", async () => {
    const screen = await render(Page, { form: null });

    await expect.element(screen.getByRole("heading", { name: "Set your password" })).toBeVisible();
    await expect.element(screen.getByLabelText("Email")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Send code" })).toBeVisible();
  });

  it("shows the code step with the email carried forward", async () => {
    const screen = await render(Page, {
      form: { step: "reset", email: "a@example.com" }
    });

    await expect.element(screen.getByLabelText("Code")).toBeVisible();
    await expect.element(screen.getByLabelText("New password")).toBeVisible();
    await expect.element(screen.getByText("a@example.com")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Set password" })).toBeVisible();
  });

  it("shows the server action's error message", async () => {
    const screen = await render(Page, { form: { error: "Invalid code" } });

    await expect.element(screen.getByRole("alert")).toHaveTextContent("Invalid code");
  });

  it("explains both first access and password reset", async () => {
    const screen = await render(Page, { form: null });

    await expect.element(screen.getByText(/first time/i)).toBeVisible();
    await expect.element(screen.getByText(/forgot your password/i)).toBeVisible();
  });

  it("shows a copyright footer with the current year", async () => {
    const screen = await render(Page, { form: null });

    await expect
      .element(
        screen
          .getByRole("contentinfo")
          .getByText(`© ${new Date().getFullYear()} PT. Vifiera Minova Bersaudara`)
      )
      .toBeVisible();
  });

  it("shows a visible error when the hidden email is missing on the code step", async () => {
    const screen = await render(Page, {
      form: {
        step: "reset",
        email: "",
        error: "Reload this page, enter your email, and request a new code",
        fieldErrors: { email: "Enter your email" }
      }
    });

    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Reload this page, enter your email, and request a new code");
  });

  describe("inline validation (#231)", () => {
    const resetStep = { step: "reset", email: "a@example.com" } as const;

    it("turns the browser's own validation off on every form", async () => {
      const request = await render(Page, { form: null });
      expect(request.container.querySelector("form")!.noValidate).toBe(true);
      await request.unmount();

      const reset = await render(Page, { form: resetStep });
      const forms = [...reset.container.querySelectorAll("form")];
      // The code form and "Send a new code".
      expect(forms).toHaveLength(2);
      expect(forms.every((form) => form.noValidate)).toBe(true);
    });

    it("asks for the email on the request step, and sends nothing", async () => {
      const screen = await render(Page, { form: null });

      await screen.getByRole("button", { name: "Send code" }).click();

      await expect.element(screen.getByText("Enter your email")).toBeVisible();
      await expect.element(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
      await expect
        .element(screen.getByLabelText("Email"))
        .toHaveAttribute("aria-describedby", "email-error");
      await expect.element(screen.getByLabelText("Email")).toHaveFocus();
      expect(submissions).toHaveLength(0);
    });

    it("asks for a well-formed email on the request step", async () => {
      const screen = await render(Page, { form: null });

      await screen.getByLabelText("Email").fill("name@");
      await screen.getByRole("button", { name: "Send code" }).click();

      await expect
        .element(screen.getByText("Enter a valid email, like name@company.com"))
        .toBeVisible();
      expect(submissions).toHaveLength(0);
    });

    it("sends a valid email", async () => {
      const screen = await render(Page, { form: null });

      await screen.getByLabelText("Email").fill("a@example.com");
      await screen.getByRole("button", { name: "Send code" }).click();

      expect(submissions.map((data) => data.get("email"))).toEqual(["a@example.com"]);
    });

    it("marks the code and the new password when both are empty, focusing the code", async () => {
      const screen = await render(Page, { form: resetStep });

      await screen.getByRole("button", { name: "Set password" }).click();

      await expect.element(screen.getByText("Enter the code from your email")).toBeVisible();
      await expect.element(screen.getByText("Enter a new password")).toBeVisible();
      await expect.element(screen.getByLabelText("Code")).toHaveAttribute("aria-invalid", "true");
      await expect
        .element(screen.getByLabelText("Code"))
        .toHaveAttribute("aria-describedby", "otp-hint otp-error");
      await expect
        .element(screen.getByLabelText("New password"))
        .toHaveAttribute("aria-describedby", "password-error");
      await expect.element(screen.getByLabelText("Code")).toHaveFocus();
      expect(submissions).toHaveLength(0);
    });

    it.each([
      ["12345", "Enter the 6-digit code from your email"],
      ["1234567", "Enter the 6-digit code from your email"],
      ["12a456", "Enter the 6-digit code from your email"]
    ])("rejects the code %j", async (code, message) => {
      const screen = await render(Page, { form: resetStep });

      await screen.getByLabelText("Code").fill(code);
      await screen.getByLabelText("New password").fill("long-enough");
      await screen.getByRole("button", { name: "Set password" }).click();

      await expect.element(screen.getByText(message)).toBeVisible();
      expect(submissions).toHaveLength(0);
    });

    it.each([
      ["short", "Use at least 8 characters"],
      ["x".repeat(129), "Use 128 characters or fewer"]
    ])("rejects the new password %#", async (password, message) => {
      const screen = await render(Page, { form: resetStep });

      await screen.getByLabelText("Code").fill("123456");
      await screen.getByLabelText("New password").fill(password);
      await screen.getByRole("button", { name: "Set password" }).click();

      await expect.element(screen.getByText(message)).toBeVisible();
      await expect.element(screen.getByLabelText("New password")).toHaveFocus();
      expect(submissions).toHaveLength(0);
    });

    it("clears the password message as soon as the password is long enough", async () => {
      const screen = await render(Page, { form: resetStep });
      const password = screen.getByLabelText("New password");
      await screen.getByLabelText("Code").fill("123456");
      await password.fill("short");
      await screen.getByRole("button", { name: "Set password" }).click();
      await expect.element(screen.getByText("Use at least 8 characters")).toBeVisible();

      await password.fill("long-enough");

      expect(screen.getByText("Use at least 8 characters").elements()).toHaveLength(0);
      await expect.element(password).not.toHaveAttribute("aria-invalid");
    });

    it("sends the code and a password within the bounds", async () => {
      const screen = await render(Page, { form: resetStep });

      await screen.getByLabelText("Code").fill("123456");
      await screen.getByLabelText("New password").fill("x".repeat(8));
      await screen.getByRole("button", { name: "Set password" }).click();

      expect(submissions).toHaveLength(1);
      expect(submissions[0]!.get("otp")).toBe("123456");
      expect(submissions[0]!.get("email")).toBe("a@example.com");
    });

    it('sends "Send a new code" without checking anything', async () => {
      const screen = await render(Page, { form: resetStep });

      await screen.getByRole("button", { name: "Send a new code" }).click();

      expect(submissions.map((data) => data.get("email"))).toEqual(["a@example.com"]);
    });

    it("marks the field a server response names", async () => {
      const screen = await render(Page, {
        form: {
          ...resetStep,
          error: "Invalid",
          fieldErrors: { otp: "Enter the code from your email" }
        }
      });

      await expect.element(screen.getByLabelText("Code")).toHaveAttribute("aria-invalid", "true");
      await expect.element(screen.getByText("Enter the code from your email")).toBeVisible();
      await expect
        .element(screen.getByLabelText("Code"))
        .toHaveAttribute("aria-describedby", "otp-hint otp-error");
      // The field message stands in for the banner.
      expect(screen.getByText("Invalid").elements()).toHaveLength(0);
    });

    it("shows Better Auth's INVALID_EMAIL at the email field, with no banner", async () => {
      const screen = await render(Page, {
        form: {
          error: "Enter a valid email, like name@company.com",
          fieldErrors: { email: "Enter a valid email, like name@company.com" }
        }
      });

      await expect
        .element(screen.getByText("Enter a valid email, like name@company.com"))
        .toBeVisible();
      await expect.element(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("alert").elements()).toHaveLength(1);
    });

    it("focuses the email when the server rejects it after the enhanced submit", async () => {
      const screen = await render(Page, { form: null });
      await screen.getByLabelText("Email").fill("a@example.com");
      await screen.getByRole("button", { name: "Send code" }).click();

      expect(submissions).toHaveLength(1);
      await completions[0]!({
        result: { type: "failure" },
        update: () =>
          screen.rerender({
            form: {
              error: "Enter a valid email, like name@company.com",
              fieldErrors: { email: "Enter a valid email, like name@company.com" }
            }
          })
      });

      await expect.element(screen.getByLabelText("Email")).toHaveFocus();
    });
  });
});
