import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cdp, userEvent } from "vitest/browser";

// A stand-in for SvelteKit's `enhance` that keeps its contract: the submit
// callback runs first and `cancel()` stops the request. What would have been
// sent is recorded instead of fetched.
const submissions = vi.hoisted(() => [] as FormData[]);
const completions = vi.hoisted(
  () =>
    [] as Array<
      (options: {
        result: { type: "failure" | "success" };
        update: () => Promise<void>;
      }) => Promise<void>
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
      | ((options: {
          result: { type: "failure" | "success" };
          update: () => Promise<void>;
        }) => Promise<void>)
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

  describe("the code step's reply (#232)", () => {
    const resetStep = { step: "reset", email: "a@exmaple.com" } as const;

    it("says a code was sent only if the email has VMB access", async () => {
      const screen = await render(Page, { form: resetStep });

      await expect
        .element(screen.getByText(/has VMB access/))
        .toHaveTextContent(
          "If a@exmaple.com has VMB access, we sent a code to it. It expires in 5 minutes."
        );
      expect(screen.getByText(/^We sent a code/).elements()).toHaveLength(0);
    });

    it("says what to do when no email arrives, with a link to support", async () => {
      const screen = await render(Page, { form: resetStep });

      await expect
        .element(screen.getByText(/No email after a minute\?/))
        .toHaveTextContent(
          "No email after a minute? Check spam, check the address, or contact support@vmblogistics.id"
        );
      await expect
        .element(screen.getByRole("link", { name: "support@vmblogistics.id" }))
        .toHaveAttribute("href", "mailto:support@vmblogistics.id");
    });

    it("goes back to the email step with the email kept for fixing", async () => {
      const screen = await render(Page, { form: resetStep });
      const link = screen.getByRole("link", { name: "Use a different email" });
      // Without JavaScript the link still reaches a fresh email step.
      await expect.element(link).toHaveAttribute("href", "/activate");

      await link.click();

      await expect.element(screen.getByRole("button", { name: "Send code" })).toBeVisible();
      await expect.element(screen.getByLabelText("Email")).toHaveValue("a@exmaple.com");
      await expect.element(screen.getByLabelText("Email")).toHaveFocus();
      expect(screen.getByLabelText("Code").elements()).toHaveLength(0);
      expect(submissions).toHaveLength(0);
    });

    it("sends the fixed email from the email step", async () => {
      const screen = await render(Page, { form: resetStep });
      await screen.getByRole("link", { name: "Use a different email" }).click();

      await screen.getByLabelText("Email").fill("a@example.com");
      await screen.getByRole("button", { name: "Send code" }).click();

      expect(submissions.map((data) => data.get("email"))).toEqual(["a@example.com"]);
    });
  });

  it("shows the server action's error message", async () => {
    const screen = await render(Page, { form: { error: "Invalid code" } });

    await expect.element(screen.getByRole("alert")).toHaveTextContent("Invalid code");
  });

  it("shows a refused code's error under the boxes and describes the code field with it", async () => {
    const screen = await render(Page, {
      form: {
        step: "reset",
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
      .toHaveAttribute("aria-describedby", "otp-hint otp-error");
    expect(screen.getByRole("alert").elements()).toHaveLength(1);
  });

  // Both places a code is requested: the email step, and "Send a new code",
  // which keeps the user on the code step (#251).
  it.each([
    ["the email step", { error: "Too many attempts. Wait a moment and try again." }, "Get a code"],
    [
      "the code step",
      {
        step: "reset",
        email: "a@example.com",
        error: "Too many attempts. Wait a moment and try again."
      },
      "Enter your code"
    ]
  ])("shows the rate-limit copy on %s", async (_step, form, heading) => {
    const screen = await render(Page, { form });

    await expect.element(screen.getByRole("heading", { name: heading })).toBeVisible();
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Too many attempts. Wait a moment and try again.");
  });

  it("explains both first access and password reset", async () => {
    const screen = await render(Page, { form: null });

    await expect.element(screen.getByText(/first time/i)).toBeVisible();
    await expect.element(screen.getByText(/forgot your password/i)).toBeVisible();
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

    it('sends "Send a new code" to the action that stays on the code step', async () => {
      const screen = await render(Page, { form: resetStep });

      const button = screen.getByRole("button", { name: "Send a new code" }).element();
      expect(button.closest("form")?.getAttribute("action")).toBe("?/resend");
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

  describe("six-box code input (#253)", () => {
    const resetStep = { step: "reset", email: "a@example.com" } as const;

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
      const screen = await render(Page, { form: resetStep });

      await expect.element(screen.getByLabelText("Code")).toBeVisible();
      expect(screen.getByLabelText("Code").elements()).toHaveLength(1);
      expect(boxes(screen.container)).toHaveLength(6);
      const code = screen.getByLabelText("Code").element();
      expect(code.getAttribute("autocomplete")).toBe("one-time-code");
      expect(code.getAttribute("inputmode")).toBe("numeric");
      expect(code.getAttribute("name")).toBe("otp");
    });

    it("fills a box per digit and takes no seventh", async () => {
      const screen = await render(Page, { form: resetStep });
      const code = screen.getByLabelText("Code");

      await code.click();
      await userEvent.keyboard("1234567");

      await expect.element(code).toHaveValue("123456");
      expect(boxes(screen.container)).toEqual(["1", "2", "3", "4", "5", "6"]);
    });

    it("refuses anything but digits", async () => {
      const screen = await render(Page, { form: resetStep });
      const code = screen.getByLabelText("Code");

      await code.click();
      await userEvent.keyboard("1a2-3");

      await expect.element(code).toHaveValue("123");
    });

    it("clears the last digit on backspace", async () => {
      const screen = await render(Page, { form: resetStep });
      const code = screen.getByLabelText("Code");

      await code.click();
      await userEvent.keyboard("123{Backspace}");

      await expect.element(code).toHaveValue("12");
      expect(boxes(screen.container)).toEqual(["1", "2", "", "", "", ""]);
    });

    it("moves between boxes with the arrow keys", async () => {
      const screen = await render(Page, { form: resetStep });
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
      const screen = await render(Page, { form: resetStep });
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
      const screen = await render(Page, { form: resetStep });
      const code = screen.getByLabelText("Code");
      await code.click();

      paste(code.element() as HTMLInputElement, text);

      await expect.element(code).toHaveValue(digits);
    });

    it("sends the form on the sixth digit once there is a password", async () => {
      const screen = await render(Page, { form: resetStep });
      await screen.getByLabelText("New password").fill("long-enough");
      await screen.getByLabelText("Code").click();

      await userEvent.keyboard("12345");
      expect(submissions).toHaveLength(0);
      await userEvent.keyboard("6");

      await expect.poll(() => submissions.length).toBe(1);
      expect(submissions[0]!.get("otp")).toBe("123456");
    });

    it("moves to the password on the sixth digit when it is still empty", async () => {
      const screen = await render(Page, { form: resetStep });
      await screen.getByLabelText("Code").click();

      await userEvent.keyboard("123456");

      await expect.element(screen.getByLabelText("New password")).toHaveFocus();
      expect(submissions).toHaveLength(0);
      expect(screen.getByRole("alert").elements()).toHaveLength(0);
    });

    it("still has the button for anyone who does not type the last digit", async () => {
      const screen = await render(Page, { form: resetStep });
      await screen.getByLabelText("Code").fill("123456");
      await screen.getByLabelText("New password").fill("long-enough");
      expect(submissions).toHaveLength(0);

      await screen.getByRole("button", { name: "Set password" }).click();

      expect(submissions).toHaveLength(1);
    });

    it("clears the boxes and focuses the first when the code is refused", async () => {
      const screen = await render(Page, { form: resetStep });
      const code = screen.getByLabelText("Code");
      await screen.getByLabelText("New password").fill("long-enough");
      await code.click();
      await userEvent.keyboard("123456");
      await expect.poll(() => completions.length).toBe(1);

      await completions[0]!({
        result: { type: "failure" },
        update: () =>
          screen.rerender({ form: { ...resetStep, errorAt: "code", error: "Invalid code" } })
      });

      await expect.element(screen.getByRole("alert")).toHaveTextContent("Invalid code");
      await expect.element(screen.getByRole("alert")).toHaveAttribute("id", "otp-error");
      await expect.element(code).toHaveValue("");
      expect(boxes(screen.container)).toEqual(["", "", "", "", "", ""]);
      await expect.element(code).toHaveFocus();
    });

    it("does not send twice while the first send is under way", async () => {
      const screen = await render(Page, { form: resetStep });
      await screen.getByLabelText("New password").fill("long-enough");
      await screen.getByLabelText("Code").click();
      await userEvent.keyboard("123456");
      await expect.poll(() => submissions.length).toBe(1);

      await userEvent.keyboard("{Backspace}6");

      expect(submissions).toHaveLength(1);
    });

    it("empties the boxes once a new code has been sent", async () => {
      const screen = await render(Page, { form: resetStep });
      const code = screen.getByLabelText("Code");
      await code.fill("123456");

      await screen.getByRole("button", { name: "Send a new code" }).click();
      await completions[0]!({
        result: { type: "success" },
        update: () => screen.rerender({ form: resetStep })
      });

      await expect.element(code).toHaveValue("");
    });

    it("marks the field and wires the hint and error to it", async () => {
      const screen = await render(Page, {
        form: { ...resetStep, error: "Invalid", fieldErrors: { otp: "Enter the code" } }
      });
      const code = screen.getByLabelText("Code");

      await expect.element(code).toHaveAttribute("aria-invalid", "true");
      await expect.element(code).toHaveAttribute("aria-describedby", "otp-hint otp-error");
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
      const screen = await render(Page, { form: null });
      const email = screen.getByLabelText("Email").element();

      expect(email.getAttribute("placeholder")).toBe("name@company.com");
      expect(decorativeIcons(email.parentElement!)).not.toHaveLength(0);
      expect(
        decorativeIcons(screen.getByRole("button", { name: "Send code" }).element())
      ).toHaveLength(1);
    });

    it("has an icon in the password field and on Set password, and none in the code boxes", async () => {
      const screen = await render(Page, { form: { step: "reset", email: "a@example.com" } });
      const code = screen.getByLabelText("Code").element();
      const password = screen.getByLabelText("New password").element();

      expect(decorativeIcons(code.closest("[data-slot=input-otp]")!)).toHaveLength(0);
      expect(password.hasAttribute("placeholder")).toBe(false);
      expect(decorativeIcons(password.parentElement!)).not.toHaveLength(0);
      expect(
        decorativeIcons(screen.getByRole("button", { name: "Set password" }).element())
      ).toHaveLength(1);
    });

    it("leaves Send a new code as words only", async () => {
      const screen = await render(Page, { form: { step: "reset", email: "a@example.com" } });

      expect(
        decorativeIcons(screen.getByRole("button", { name: "Send a new code" }).element())
      ).toHaveLength(0);
    });
  });

  describe("moving to the code step", () => {
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

    async function sendCode(type: "success" | "failure") {
      const screen = await render(Page, { form: null });
      await screen.getByLabelText("Email").fill("a@example.com");
      await screen.getByRole("button", { name: "Send code" }).click();
      const update = vi.fn(async () => {});
      await completions[0]!({ result: { type }, update });
      return update;
    }

    it("swaps the steps inside a view transition", async () => {
      const transition = stubTransition();

      const update = await sendCode("success");

      expect(transition).toHaveBeenCalledOnce();
      expect(update).toHaveBeenCalledOnce();
    });

    it("swaps the steps at once when the user prefers reduced motion", async () => {
      await cdp().send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }]
      });
      const transition = stubTransition();

      const update = await sendCode("success");

      expect(transition).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledOnce();
    });

    it("keeps the step in place, with no transition, when the code is refused", async () => {
      const transition = stubTransition();

      const update = await sendCode("failure");

      expect(transition).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledOnce();
    });
  });
});
