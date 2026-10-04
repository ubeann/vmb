import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cdp, userEvent } from "vitest/browser";

// What an action replied, as far as the page reads it: the step it names, if any.
type Result = { type: "failure" | "success" | "redirect"; data?: Record<string, unknown> };

// A stand-in for SvelteKit's `enhance` that keeps its contract: the submit
// callback runs first and `cancel()` stops the request. What would have been
// sent is recorded instead of fetched.
const submissions = vi.hoisted(() => [] as FormData[]);
const completions = vi.hoisted(
  () => [] as Array<(options: { result: Result; update: () => Promise<void> }) => Promise<void>>
);
vi.mock("$app/forms", () => ({
  enhance: (
    form: HTMLFormElement,
    submit?: (input: {
      formElement: HTMLFormElement;
      cancel: () => void;
    }) => void | ((options: { result: Result; update: () => Promise<void> }) => Promise<void>)
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

afterEach(async () => {
  vi.restoreAllMocks();
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }]
  });
});

// The page's props. `data` is the load's: a checked code puts it on the
// password step.
const noCheckedCode = { user: null, step: undefined, email: undefined };
const emailStep = { data: noCheckedCode, form: null };
const codeStep = { data: noCheckedCode, form: { step: "code", email: "a@example.com" } } as const;
const passwordStep = {
  data: { user: null, step: "password", email: "a@example.com" },
  form: null
} as const;

// The change is applied inside the callback the browser calls once it has
// captured the old card, as a real view transition does.
function stubTransition() {
  const settled = Promise.resolve();
  return vi.spyOn(document, "startViewTransition").mockImplementation(((
    update: () => Promise<void>
  ) => ({
    ready: settled,
    finished: settled,
    updateCallbackDone: update()
  })) as never);
}

describe("activate page", () => {
  it("asks for the email first", async () => {
    const screen = await render(Page, emailStep);

    await expect.element(screen.getByRole("heading", { name: "Set your password" })).toBeVisible();
    await expect.element(screen.getByRole("heading", { name: "Get a code" })).toBeVisible();
    await expect.element(screen.getByLabelText("Email")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Send code" })).toBeVisible();
  });

  it("explains both first access and password reset", async () => {
    const screen = await render(Page, emailStep);

    await expect.element(screen.getByText(/first time/i)).toBeVisible();
    await expect.element(screen.getByText(/forgot your password/i)).toBeVisible();
  });

  it("shows the server action's error message", async () => {
    const screen = await render(Page, { data: noCheckedCode, form: { error: "Invalid code" } });

    await expect.element(screen.getByRole("alert")).toHaveTextContent("Invalid code");
  });

  describe("the code step", () => {
    it("holds the code, Verify, a new code and a way back, and no password", async () => {
      const screen = await render(Page, codeStep);

      await expect.element(screen.getByRole("heading", { name: "Enter your code" })).toBeVisible();
      await expect.element(screen.getByLabelText("Code")).toBeVisible();
      await expect.element(screen.getByRole("button", { name: "Verify code" })).toBeVisible();
      await expect.element(screen.getByRole("button", { name: "Send a new code" })).toBeVisible();
      await expect
        .element(screen.getByRole("link", { name: "Use a different email" }))
        .toBeVisible();
      expect(screen.getByLabelText("New password").elements()).toHaveLength(0);
    });

    it("sends the code with the email it was sent to, to Verify", async () => {
      const screen = await render(Page, codeStep);
      const verify = screen.getByRole("button", { name: "Verify code" }).element();

      await screen.getByLabelText("Code").fill("123456");

      await expect.poll(() => submissions.length).toBe(1);
      expect([...submissions[0]!.entries()]).toEqual([
        ["email", "a@example.com"],
        ["otp", "123456"]
      ]);
      expect(verify.closest("form")?.getAttribute("action")).toBe("?/verify");
    });

    // The same words whether or not the email belongs to a user (#232).
    it("says a code was sent only if the email has VMB access", async () => {
      const screen = await render(Page, codeStep);

      await expect
        .element(screen.getByText(/has VMB access/))
        .toHaveTextContent(
          "If a@example.com has VMB access, we sent a code to it. It expires in 5 minutes."
        );
      expect(screen.getByText(/^We sent a code/).elements()).toHaveLength(0);
    });

    it("says what to do when no email arrives, with a link to support", async () => {
      const screen = await render(Page, codeStep);

      await expect
        .element(screen.getByText(/No email after a minute\?/))
        .toHaveTextContent(
          "No email after a minute? Check your spam folder and the address, or contact support@vmblogistics.id."
        );
      await expect
        .element(screen.getByRole("link", { name: "support@vmblogistics.id" }))
        .toHaveAttribute("href", "mailto:support@vmblogistics.id");
    });

    it("goes back to the email step with the email kept for fixing", async () => {
      const screen = await render(Page, codeStep);
      const link = screen.getByRole("link", { name: "Use a different email" });
      // Without JavaScript the link still reaches a fresh email step.
      await expect.element(link).toHaveAttribute("href", "/activate");

      await link.click();

      await expect.element(screen.getByRole("button", { name: "Send code" })).toBeVisible();
      await expect.element(screen.getByLabelText("Email")).toHaveValue("a@example.com");
      await expect.element(screen.getByLabelText("Email")).toHaveFocus();
      expect(screen.getByLabelText("Code").elements()).toHaveLength(0);
      expect(submissions).toHaveLength(0);
    });

    it("sends the fixed email from the email step", async () => {
      const screen = await render(Page, codeStep);
      await screen.getByRole("link", { name: "Use a different email" }).click();

      await screen.getByLabelText("Email").fill("b@example.com");
      await screen.getByRole("button", { name: "Send code" }).click();

      expect(submissions.map((data) => data.get("email"))).toEqual(["b@example.com"]);
    });

    it("shows a refused code's error under the boxes and describes the code field with it", async () => {
      const screen = await render(Page, {
        data: noCheckedCode,
        form: {
          step: "code",
          email: "a@example.com",
          errorAt: "code",
          error: "That code isn't right. Enter it again."
        }
      });

      const error = screen.getByRole("alert");
      await expect.element(error).toHaveTextContent("That code isn't right. Enter it again.");
      await expect.element(error).toHaveAttribute("id", "otp-error");
      await expect
        .element(screen.getByLabelText("Code"))
        .toHaveAttribute("aria-describedby", "otp-error");
      expect(screen.getByRole("alert").elements()).toHaveLength(1);
    });

    it('sends "Send a new code" to the action that stays on the code step, checking nothing', async () => {
      const screen = await render(Page, codeStep);

      await screen.getByRole("button", { name: "Send a new code" }).click();

      expect(submissions.map((data) => data.get("email"))).toEqual(["a@example.com"]);
      const button = screen.getByRole("button", { name: "Send a new code" }).element();
      expect(button.closest("form")?.getAttribute("action")).toBe("?/resend");
    });

    it("shows a visible error when the hidden email is missing", async () => {
      const screen = await render(Page, {
        data: noCheckedCode,
        form: {
          step: "code",
          email: "",
          error: "Reload this page, enter your email, and request a new code",
          fieldErrors: { email: "Enter your email" }
        }
      });

      await expect
        .element(screen.getByRole("alert"))
        .toHaveTextContent("Reload this page, enter your email, and request a new code");
    });
    // The error says what the hint said, so it takes the hint's place, as the
    // password field's does.
    it("shows a code error in place of the hint", async () => {
      const screen = await render(Page, codeStep);

      await screen.getByRole("button", { name: "Verify code" }).click();

      await expect.element(screen.getByText("Enter the code from your email")).toBeVisible();
      expect(screen.getByText("Enter the 6-digit code from your email.").elements()).toHaveLength(
        0
      );
    });
  });

  describe("the password step", () => {
    it("only sets the password, for the email whose code was checked", async () => {
      const screen = await render(Page, passwordStep);

      await expect
        .element(screen.getByRole("heading", { name: "Choose a new password" }))
        .toBeVisible();
      await expect.element(screen.getByText("a@example.com")).toBeVisible();
      await expect.element(screen.getByLabelText("New password")).toBeVisible();
      await expect.element(screen.getByRole("button", { name: "Set password" })).toBeVisible();
      expect(screen.getByLabelText("Code").elements()).toHaveLength(0);
      expect(screen.getByRole("button", { name: "Send a new code" }).elements()).toHaveLength(0);
    });

    it("posts the new password alone: the code waits on the server", async () => {
      const screen = await render(Page, passwordStep);

      const button = screen.getByRole("button", { name: "Set password" }).element();

      await screen.getByLabelText("New password").fill("long-enough");
      await screen.getByRole("button", { name: "Set password" }).click();

      expect(submissions).toHaveLength(1);
      expect([...submissions[0]!.entries()]).toEqual([["password", "long-enough"]]);
      expect(button.closest("form")?.getAttribute("action")).toBe("?/reset");
    });

    // A password manager saves the new password under this email.
    it("names the email to password managers without posting it", async () => {
      const screen = await render(Page, passwordStep);

      const username = screen.container.querySelector<HTMLInputElement>(
        'input[autocomplete="username"]'
      );
      expect(username?.value).toBe("a@example.com");
      expect(username?.name).toBe("");
    });

    it("never puts a code in the page", async () => {
      const screen = await render(Page, passwordStep);

      expect(screen.container.innerHTML).not.toMatch(/\d{6}/);
    });

    it("starts over from a form, so the checked code is dropped on the server", async () => {
      const screen = await render(Page, passwordStep);
      const button = screen.getByRole("button", { name: "Use a different email" });

      await button.click();

      expect(submissions).toHaveLength(1);
      expect(button.element().closest("form")?.getAttribute("action")).toBe("?/restart");
    });

    // After the password step sends the user back, the reply's step wins over
    // the load's, whose checked code is gone.
    it("gives way to the code step the reply names", async () => {
      const screen = await render(Page, {
        data: passwordStep.data,
        form: {
          step: "code",
          email: "a@example.com",
          errorAt: "code",
          error: "This code expired. Send a new one."
        }
      });

      await expect.element(screen.getByLabelText("Code")).toBeVisible();
      await expect
        .element(screen.getByRole("alert"))
        .toHaveTextContent("This code expired. Send a new one.");
      expect(screen.getByLabelText("New password").elements()).toHaveLength(0);
    });

    it("shows a rate limit in the banner and stays", async () => {
      const screen = await render(Page, {
        data: passwordStep.data,
        form: {
          step: "password",
          email: "a@example.com",
          error: "Too many attempts. Wait a moment and try again."
        }
      });

      await expect.element(screen.getByLabelText("New password")).toBeVisible();
      await expect
        .element(screen.getByRole("alert"))
        .toHaveTextContent("Too many attempts. Wait a moment and try again.");
    });
  });

  // Both places a code is requested: the email step, and "Send a new code",
  // which keeps the user on the code step (#251).
  it.each([
    ["the email step", { error: "Too many attempts. Wait a moment and try again." }, "Get a code"],
    [
      "the code step",
      {
        step: "code",
        email: "a@example.com",
        error: "Too many attempts. Wait a moment and try again."
      },
      "Enter your code"
    ]
  ])("shows the rate-limit copy on %s", async (_step, form, heading) => {
    const screen = await render(Page, { data: noCheckedCode, form });

    await expect.element(screen.getByRole("heading", { name: heading })).toBeVisible();
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Too many attempts. Wait a moment and try again.");
  });

  describe("inline validation (#231)", () => {
    it("turns the browser's own validation off on every form", async () => {
      for (const props of [emailStep, codeStep, passwordStep]) {
        const screen = await render(Page, props);
        const forms = [...screen.container.querySelectorAll("form")];
        expect(forms.length).toBeGreaterThan(0);
        expect(forms.every((form) => form.noValidate)).toBe(true);
        await screen.unmount();
      }
    });

    it("asks for the email on the email step, and sends nothing", async () => {
      const screen = await render(Page, emailStep);

      await screen.getByRole("button", { name: "Send code" }).click();

      await expect.element(screen.getByText("Enter your email")).toBeVisible();
      await expect.element(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
      await expect
        .element(screen.getByLabelText("Email"))
        .toHaveAttribute("aria-describedby", "email-error");
      await expect.element(screen.getByLabelText("Email")).toHaveFocus();
      expect(submissions).toHaveLength(0);
    });

    it("asks for a well-formed email on the email step", async () => {
      const screen = await render(Page, emailStep);

      await screen.getByLabelText("Email").fill("name@");
      await screen.getByRole("button", { name: "Send code" }).click();

      await expect
        .element(screen.getByText("Enter a valid email, like name@example.com"))
        .toBeVisible();
      expect(submissions).toHaveLength(0);
    });

    it("sends a valid email", async () => {
      const screen = await render(Page, emailStep);

      await screen.getByLabelText("Email").fill("a@example.com");
      await screen.getByRole("button", { name: "Send code" }).click();

      expect(submissions.map((data) => data.get("email"))).toEqual(["a@example.com"]);
    });

    it("asks for the code when it is empty, focusing it", async () => {
      const screen = await render(Page, codeStep);

      await screen.getByRole("button", { name: "Verify code" }).click();

      await expect.element(screen.getByText("Enter the code from your email")).toBeVisible();
      await expect.element(screen.getByLabelText("Code")).toHaveAttribute("aria-invalid", "true");
      await expect
        .element(screen.getByLabelText("Code"))
        .toHaveAttribute("aria-describedby", "otp-error");
      await expect.element(screen.getByLabelText("Code")).toHaveFocus();
      expect(submissions).toHaveLength(0);
    });

    it.each([
      ["12345", "Enter the 6-digit code from your email"],
      ["12a456", "Enter the 6-digit code from your email"]
    ])("rejects the code %j", async (code, message) => {
      const screen = await render(Page, codeStep);

      await screen.getByLabelText("Code").fill(code);
      await screen.getByRole("button", { name: "Verify code" }).click();

      await expect.element(screen.getByText(message)).toBeVisible();
      expect(submissions).toHaveLength(0);
    });

    it.each([
      ["", "Enter a new password"],
      ["short", "Use at least 8 characters"],
      ["x".repeat(129), "Use 128 characters or fewer"]
    ])("rejects the new password %#", async (password, message) => {
      const screen = await render(Page, passwordStep);

      await screen.getByLabelText("New password").fill(password);
      await screen.getByRole("button", { name: "Set password" }).click();

      await expect.element(screen.getByText(message)).toBeVisible();
      await expect
        .element(screen.getByLabelText("New password"))
        .toHaveAttribute("aria-describedby", "password-error");
      await expect.element(screen.getByLabelText("New password")).toHaveFocus();
      expect(submissions).toHaveLength(0);
    });

    it("clears the password message as soon as the password is long enough", async () => {
      const screen = await render(Page, passwordStep);
      const password = screen.getByLabelText("New password");
      await password.fill("short");
      await screen.getByRole("button", { name: "Set password" }).click();
      await expect.element(screen.getByText("Use at least 8 characters")).toBeVisible();

      await password.fill("long-enough");

      expect(screen.getByText("Use at least 8 characters").elements()).toHaveLength(0);
      await expect.element(password).not.toHaveAttribute("aria-invalid");
    });

    it("marks the field a server response names", async () => {
      const screen = await render(Page, {
        data: noCheckedCode,
        form: {
          ...codeStep.form,
          error: "Invalid",
          fieldErrors: { otp: "Enter the code from your email" }
        }
      });

      await expect.element(screen.getByLabelText("Code")).toHaveAttribute("aria-invalid", "true");
      await expect.element(screen.getByText("Enter the code from your email")).toBeVisible();
      // The field message stands in for the banner.
      expect(screen.getByText("Invalid").elements()).toHaveLength(0);
    });

    it("shows Better Auth's INVALID_EMAIL at the email field, with no banner", async () => {
      const screen = await render(Page, {
        data: noCheckedCode,
        form: {
          error: "Enter a valid email, like name@example.com",
          fieldErrors: { email: "Enter a valid email, like name@example.com" }
        }
      });

      await expect
        .element(screen.getByText("Enter a valid email, like name@example.com"))
        .toBeVisible();
      await expect.element(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("alert").elements()).toHaveLength(1);
    });

    it("focuses the email when the server rejects it after the enhanced submit", async () => {
      const screen = await render(Page, emailStep);
      await screen.getByLabelText("Email").fill("a@example.com");
      await screen.getByRole("button", { name: "Send code" }).click();

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

  describe("six-box code input (#253)", () => {
    // What the browser does when a code is pasted into the focused field.
    function paste(input: HTMLInputElement, text: string) {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", text);
      input.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true })
      );
    }

    const boxes = (container: Element) =>
      [...container.querySelectorAll("[data-slot=input-otp-slot]")].map(
        (box) => box.textContent?.trim() ?? ""
      );

    it("draws six boxes for one field named Code", async () => {
      const screen = await render(Page, codeStep);

      await expect.element(screen.getByLabelText("Code")).toBeVisible();
      expect(screen.getByLabelText("Code").elements()).toHaveLength(1);
      expect(boxes(screen.container)).toHaveLength(6);
      const code = screen.getByLabelText("Code").element();
      expect(code.getAttribute("autocomplete")).toBe("one-time-code");
      expect(code.getAttribute("inputmode")).toBe("numeric");
      expect(code.getAttribute("name")).toBe("otp");
    });

    it("fills a box per digit and takes no seventh", async () => {
      const screen = await render(Page, codeStep);
      const code = screen.getByLabelText("Code");

      await code.click();
      await userEvent.keyboard("1234567");

      await expect.element(code).toHaveValue("123456");
      expect(boxes(screen.container)).toEqual(["1", "2", "3", "4", "5", "6"]);
    });

    it("refuses anything but digits", async () => {
      const screen = await render(Page, codeStep);
      const code = screen.getByLabelText("Code");

      await code.click();
      await userEvent.keyboard("1a2-3");

      await expect.element(code).toHaveValue("123");
    });

    it("clears the last digit on backspace", async () => {
      const screen = await render(Page, codeStep);
      const code = screen.getByLabelText("Code");

      await code.click();
      await userEvent.keyboard("123{Backspace}");

      await expect.element(code).toHaveValue("12");
      expect(boxes(screen.container)).toEqual(["1", "2", "", "", "", ""]);
    });

    it("moves between boxes with the arrow keys", async () => {
      const screen = await render(Page, codeStep);
      const code = screen.getByLabelText("Code");

      await code.click();
      await userEvent.keyboard("123");
      await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
      const active = () =>
        [...screen.container.querySelectorAll("[data-slot=input-otp-slot]")].findIndex((box) =>
          box.hasAttribute("data-active")
        );
      await expect.poll(active).toBe(1);

      await userEvent.keyboard("{ArrowRight}");
      await expect.poll(active).toBe(2);
    });

    it("fills every box from a pasted code", async () => {
      const screen = await render(Page, codeStep);
      const code = screen.getByLabelText("Code");
      await code.click();

      paste(code.element() as HTMLInputElement, "246810");

      await expect.element(code).toHaveValue("246810");
      expect(boxes(screen.container)).toEqual(["2", "4", "6", "8", "1", "0"]);
    });

    it.each([
      ["123 456", "123456"],
      ["123-456", "123456"],
      [" 1 2 3 – 4 5 6 ", "123456"]
    ])("keeps only the digits of a pasted %j", async (text, digits) => {
      const screen = await render(Page, codeStep);
      const code = screen.getByLabelText("Code");
      await code.click();

      paste(code.element() as HTMLInputElement, text);

      await expect.element(code).toHaveValue(digits);
    });

    it("sends Verify on the sixth digit", async () => {
      const screen = await render(Page, codeStep);
      await screen.getByLabelText("Code").click();

      await userEvent.keyboard("12345");
      expect(submissions).toHaveLength(0);
      await userEvent.keyboard("6");

      await expect.poll(() => submissions.length).toBe(1);
      expect(submissions[0]!.get("otp")).toBe("123456");
    });

    // Such as a code that was in the field before the page hydrated, when the
    // boxes took it over without anything being typed.
    it("still has the button for a code the last digit did not send", async () => {
      const screen = await render(Page, codeStep);
      await screen.getByLabelText("Code").fill("12345");
      (screen.getByLabelText("Code").element() as HTMLInputElement).value = "123456";

      await screen.getByRole("button", { name: "Verify code" }).click();

      expect(submissions).toHaveLength(1);
      expect(submissions[0]!.get("otp")).toBe("123456");
    });

    it("clears the boxes and focuses the first when the code is refused", async () => {
      const screen = await render(Page, codeStep);
      const code = screen.getByLabelText("Code");
      await code.click();
      await userEvent.keyboard("123456");
      await expect.poll(() => completions.length).toBe(1);

      await completions[0]!({
        result: { type: "failure", data: { step: "code" } },
        update: () =>
          screen.rerender({ form: { ...codeStep.form, errorAt: "code", error: "Invalid code" } })
      });

      await expect.element(screen.getByRole("alert")).toHaveTextContent("Invalid code");
      await expect.element(screen.getByRole("alert")).toHaveAttribute("id", "otp-error");
      await expect.element(code).toHaveValue("");
      expect(boxes(screen.container)).toEqual(["", "", "", "", "", ""]);
      await expect.element(code).toHaveFocus();
    });

    it("does not send twice while the first send is under way", async () => {
      const screen = await render(Page, codeStep);
      await screen.getByLabelText("Code").click();
      await userEvent.keyboard("123456");
      await expect.poll(() => submissions.length).toBe(1);

      await userEvent.keyboard("{Backspace}6");

      expect(submissions).toHaveLength(1);
    });

    it("empties the boxes once a new code has been sent", async () => {
      const screen = await render(Page, codeStep);
      const code = screen.getByLabelText("Code");
      await code.fill("12345");

      await screen.getByRole("button", { name: "Send a new code" }).click();
      await completions[0]!({
        result: { type: "success", data: codeStep.form },
        update: () => screen.rerender(codeStep)
      });

      await expect.element(code).toHaveValue("");
    });

    it("marks the field and wires the hint and error to it", async () => {
      const screen = await render(Page, {
        data: noCheckedCode,
        form: { ...codeStep.form, error: "Invalid", fieldErrors: { otp: "Enter the code" } }
      });
      const code = screen.getByLabelText("Code");

      await expect.element(code).toHaveAttribute("aria-invalid", "true");
      await expect.element(code).toHaveAttribute("aria-describedby", "otp-error");
      // Boxes are not fields: only the input carries the state.
      expect(
        screen.container.querySelectorAll("[data-slot=input-otp-slot][aria-invalid]")
      ).toHaveLength(0);
      const box = screen.container.querySelector("[data-slot=input-otp-slot]")!;
      expect(getComputedStyle(box).borderColor).not.toBe(
        getComputedStyle(screen.container.querySelector("[data-slot=input-otp]")!).borderColor
      );
    });
  });

  describe("field icons and hints (#234)", () => {
    const decorativeIcons = (element: Element) =>
      [...element.querySelectorAll("svg")].filter(
        (icon) => icon.getAttribute("aria-hidden") === "true"
      );

    it("hints the email format and puts an icon in the field and on Send code", async () => {
      const screen = await render(Page, emailStep);
      const email = screen.getByLabelText("Email").element();

      expect(email.getAttribute("placeholder")).toBe("name@example.com");
      expect(decorativeIcons(email.parentElement!)).not.toHaveLength(0);
      expect(
        decorativeIcons(screen.getByRole("button", { name: "Send code" }).element())
      ).toHaveLength(1);
    });

    it("has an icon on Verify code, and none in the code boxes or on Send a new code", async () => {
      const screen = await render(Page, codeStep);
      const code = screen.getByLabelText("Code").element();

      expect(decorativeIcons(code.closest("[data-slot=input-otp]")!)).toHaveLength(0);
      expect(
        decorativeIcons(screen.getByRole("button", { name: "Verify code" }).element())
      ).toHaveLength(1);
      expect(
        decorativeIcons(screen.getByRole("button", { name: "Send a new code" }).element())
      ).toHaveLength(0);
    });

    it("has an icon in the password field and on Set password", async () => {
      const screen = await render(Page, passwordStep);
      const password = screen.getByLabelText("New password").element();

      expect(password.hasAttribute("placeholder")).toBe(false);
      expect(decorativeIcons(password.parentElement!)).not.toHaveLength(0);
      expect(
        decorativeIcons(screen.getByRole("button", { name: "Set password" }).element())
      ).toHaveLength(1);
    });

    it("hints the code length and the password length before either is wrong", async () => {
      const code = await render(Page, codeStep);
      await expect.element(code.getByText("Enter the 6-digit code from your email.")).toBeVisible();
      await code.unmount();

      const password = await render(Page, passwordStep);
      await expect.element(password.getByText("Use at least 8 characters.")).toBeVisible();
      await expect
        .element(password.getByLabelText("New password"))
        .toHaveAttribute("aria-describedby", "password-hint");
    });
  });

  // Each step change moves the card the way a change of page does, and puts
  // focus on the new step's first field.
  describe("moving between steps", () => {
    // `send` submits the step's form the way a user would; the reply is then
    // played back through the enhanced form's callback.
    async function submitAndReply(
      props: object,
      send: (screen: Awaited<ReturnType<typeof render>>) => Promise<unknown>,
      result: Result,
      next: object
    ) {
      const screen = await render(Page, props as never);
      await send(screen);
      await expect.poll(() => completions.length).toBe(1);
      await completions[0]!({ result, update: () => screen.rerender(next as never) });
      return screen;
    }

    const sendEmail = async (screen: Awaited<ReturnType<typeof render>>) => {
      await screen.getByLabelText("Email").fill("a@example.com");
      await screen.getByRole("button", { name: "Send code" }).click();
    };
    // The sixth digit sends Verify.
    const sendCode = (screen: Awaited<ReturnType<typeof render>>) =>
      screen.getByLabelText("Code").fill("123456");

    it("moves from the email to the code, focusing the code", async () => {
      const transition = stubTransition();

      const screen = await submitAndReply(
        emailStep,
        sendEmail,
        { type: "success", data: codeStep.form },
        codeStep
      );

      expect(transition).toHaveBeenCalledOnce();
      await expect.element(screen.getByLabelText("Code")).toHaveFocus();
    });

    it("moves from the code to the password once the code checks out, focusing the password", async () => {
      const transition = stubTransition();

      const screen = await submitAndReply(
        codeStep,
        sendCode,
        { type: "success", data: { step: "password", email: "a@example.com" } },
        { data: passwordStep.data, form: { step: "password", email: "a@example.com" } }
      );

      expect(transition).toHaveBeenCalledOnce();
      await expect.element(screen.getByLabelText("New password")).toHaveFocus();
    });

    it("moves back to an empty code when the password step finds the code expired", async () => {
      const transition = stubTransition();
      const expired = {
        step: "code",
        email: "a@example.com",
        errorAt: "code",
        error: "This code expired. Send a new one."
      };

      const screen = await submitAndReply(
        passwordStep,
        async (screen) => {
          await screen.getByLabelText("New password").fill("long-enough");
          await screen.getByRole("button", { name: "Set password" }).click();
        },
        { type: "failure", data: expired },
        { data: passwordStep.data, form: expired }
      );

      expect(transition).toHaveBeenCalledOnce();
      await expect.element(screen.getByLabelText("Code")).toHaveFocus();
      await expect.element(screen.getByLabelText("Code")).toHaveValue("");
      await expect
        .element(screen.getByRole("alert"))
        .toHaveTextContent("This code expired. Send a new one.");
    });

    it("moves from the password to the email when starting over, focusing the email", async () => {
      const transition = stubTransition();

      const screen = await submitAndReply(
        passwordStep,
        (screen) => screen.getByRole("button", { name: "Use a different email" }).click(),
        { type: "success", data: { step: "request", email: "a@example.com" } },
        { data: noCheckedCode, form: { step: "request", email: "a@example.com" } }
      );

      expect(transition).toHaveBeenCalledOnce();
      await expect.element(screen.getByLabelText("Email")).toHaveFocus();
      await expect.element(screen.getByLabelText("Email")).toHaveValue("a@example.com");
    });

    it("moves at once when the user prefers reduced motion", async () => {
      await cdp().send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }]
      });
      const transition = stubTransition();

      const screen = await submitAndReply(
        emailStep,
        sendEmail,
        { type: "success", data: codeStep.form },
        codeStep
      );

      expect(transition).not.toHaveBeenCalled();
      await expect.element(screen.getByLabelText("Code")).toHaveFocus();
    });

    it("keeps the step in place, with no transition, when the reply stays on it", async () => {
      const transition = stubTransition();

      await submitAndReply(
        codeStep,
        sendCode,
        { type: "failure", data: { ...codeStep.form, errorAt: "code", error: "Invalid code" } },
        { data: noCheckedCode, form: { ...codeStep.form, errorAt: "code", error: "Invalid code" } }
      );

      expect(transition).not.toHaveBeenCalled();
    });
  });
});
