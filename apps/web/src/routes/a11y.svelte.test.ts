import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet. axe reads real colours and
// layout, so the classes need to apply here.
import "../app.css";

import { axeViolations } from "$lib/a11y-support.js";

// The signed-out pages (#208): axe over every state of /login, each /activate
// step and the error page, in both colour schemes.
const mockPage: {
  url: URL;
  status: number;
  error: { message: string } | null;
  data: { user: null };
} = {
  url: new URL("http://localhost/login"),
  status: 404,
  error: { message: "Not Found" },
  data: { user: null }
};

vi.mock("$app/forms", () => ({
  enhance: () => ({ destroy() {} })
}));
vi.mock("$app/paths", () => ({
  resolve: (path: string) => (path.startsWith("/") ? path : `/${path}`)
}));
vi.mock("$app/state", () => ({
  page: mockPage
}));

const { render } = await import("vitest-browser-svelte");
const { default: LoginPage } = await import("./(auth)/login/+page.svelte");
const { default: ActivatePage } = await import("./(auth)/activate/+page.svelte");
const { default: ErrorPage } = await import("./+error.svelte");

const noCheckedCode = { user: null, step: undefined, email: undefined };
const activateStates = {
  "the email step": { data: noCheckedCode, form: null },
  "the email step, with a refusal": { data: noCheckedCode, form: { error: "Try again soon." } },
  "the code step": { data: noCheckedCode, form: { step: "code", email: "a@example.com" } },
  "the code step, with a wrong code": {
    data: noCheckedCode,
    form: {
      step: "code",
      email: "a@example.com",
      error: "That code is not right.",
      errorAt: "code"
    }
  },
  "the password step": {
    data: { user: null, step: "password", email: "a@example.com" },
    form: null
  }
} as const;

// `.dark` is what mode-watcher sets on <html>.
const schemes = ["light", "dark"] as const;
const setScheme = (scheme: (typeof schemes)[number]) =>
  document.documentElement.classList.toggle("dark", scheme === "dark");

afterEach(() => {
  document.documentElement.classList.remove("dark");
  mockPage.url = new URL("http://localhost/login");
  mockPage.status = 404;
  mockPage.error = { message: "Not Found" };
});

describe.each(schemes)("auth pages, %s", (scheme) => {
  it("has no axe violations on the empty login form", async () => {
    setScheme(scheme);
    const screen = await render(LoginPage, { form: null });

    expect(await axeViolations(screen.container)).toEqual([]);
  });

  it("has none with every notice and a field error showing", async () => {
    setScheme(scheme);
    mockPage.url = new URL("http://localhost/login?verified=true&activated=true&logged_out=true");
    const screen = await render(LoginPage, {
      form: {
        fieldErrors: { email: "Enter a valid email address.", password: "Enter your password." }
      }
    });

    expect(await axeViolations(screen.container)).toEqual([]);
  });

  it("has none under a server refusal", async () => {
    setScheme(scheme);
    const screen = await render(LoginPage, { form: { error: "Email or password is wrong." } });

    expect(await axeViolations(screen.container)).toEqual([]);
  });

  it.each(Object.entries(activateStates))("has none on activate: %s", async (_name, props) => {
    setScheme(scheme);
    const screen = await render(ActivatePage, props as never);

    expect(await axeViolations(screen.container)).toEqual([]);
  });

  it.each([
    [404, { message: "Not Found" }],
    [500, { message: "Internal Error" }]
  ] as const)("has none on the %s error page", async (status, error) => {
    setScheme(scheme);
    mockPage.status = status;
    mockPage.error = error;
    const screen = await render(ErrorPage);

    expect(await axeViolations(screen.container)).toEqual([]);
  });
});

// Tab until `target` has focus, as a keyboard user reaches it (so it counts as
// focus-visible), without counting the stops before it.
async function tabTo(target: Element) {
  for (let stop = 0; stop < 12 && document.activeElement !== target; stop++) {
    await userEvent.tab();
  }
  expect(document.activeElement).toBe(target);
}

describe("accessible names and autofill hints", () => {
  it("names the checkbox and the password toggle, and keeps the toggle's name through a press", async () => {
    const screen = await render(LoginPage, { form: null });

    await expect.element(screen.getByRole("checkbox", { name: "Remember me" })).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Show password" }))
      .toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    // Same name, new state: the toggle is not renamed "Hide password".
    await expect
      .element(screen.getByRole("button", { name: "Show password" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("tells password managers the login fields", async () => {
    const screen = await render(LoginPage, { form: null });

    await expect.element(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    await expect
      .element(screen.getByLabelText("Password", { exact: true }))
      .toHaveAttribute("autocomplete", "current-password");
  });

  it("tells them the code is a one-time code, and the new password is new", async () => {
    const code = await render(ActivatePage, activateStates["the code step"] as never);
    await expect
      .element(code.getByLabelText("Code"))
      .toHaveAttribute("autocomplete", "one-time-code");
    await expect.element(code.getByLabelText("Code")).toHaveAttribute("inputmode", "numeric");

    const password = await render(ActivatePage, activateStates["the password step"] as never);
    await expect
      .element(password.getByLabelText("New password"))
      .toHaveAttribute("autocomplete", "new-password");
  });
});

describe("the axe check", () => {
  it("reports a control with no accessible name, so a clean run means something", async () => {
    const screen = await render(LoginPage, { form: null });
    const unnamed = document.createElement("button");
    screen.container.append(unnamed);

    expect(await axeViolations(screen.container)).toEqual([expect.stringContaining("button-name")]);
  });
});

// The registry's focus ring is the ring colour at half strength, 2.2:1 on paper;
// app.css lifts it to the full colour (#208). `--tw-ring-color` is what the
// ring's box-shadow reads.
describe("focus rings", () => {
  const ringOf = (element: Element) =>
    getComputedStyle(element).getPropertyValue("--tw-ring-color").trim();
  const token = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  it.each(schemes)(
    "draw fields, the checkbox and the button in the full ring colour, %s",
    async (scheme) => {
      setScheme(scheme);
      const screen = await render(LoginPage, { form: null });

      for (const target of [
        screen.getByLabelText("Email"),
        screen.getByRole("checkbox", { name: "Remember me" }),
        screen.getByRole("button", { name: "Log in" })
      ]) {
        await tabTo(target.element());
        expect(ringOf(target.element())).toBe(token("--ring"));
      }
    }
  );

  it.each(schemes)("draw a focused invalid field in the full error colour, %s", async (scheme) => {
    setScheme(scheme);
    const screen = await render(LoginPage, {
      form: { fieldErrors: { email: "Enter a valid email address." } }
    });

    const email = screen.getByLabelText("Email").element();
    await tabTo(email);
    expect(ringOf(email)).toBe(token("--destructive"));
  });

  it.each(schemes)(
    "draw the active code box in the ring colour, or the error colour when invalid, %s",
    async (scheme) => {
      setScheme(scheme);
      const activeBox = () => document.querySelector("[data-slot='input-otp-slot'][data-active]");
      const ringOfActiveBox = async (props: unknown) => {
        const screen = await render(ActivatePage, props as never);
        // The boxes replace a plain field once the page has hydrated.
        await expect
          .poll(() => screen.container.querySelector("[data-slot='input-otp']"))
          .not.toBeNull();
        await tabTo(screen.container.querySelector("input[name='otp']")!);
        await expect.poll(activeBox).not.toBeNull();
        const ring = ringOf(activeBox()!);
        screen.unmount();
        return ring;
      };

      expect(await ringOfActiveBox(activateStates["the code step"])).toBe(token("--ring"));
      expect(
        await ringOfActiveBox({
          data: noCheckedCode,
          form: {
            step: "code",
            email: "a@example.com",
            fieldErrors: { otp: "Enter the 6-digit code." }
          }
        })
      ).toBe(token("--destructive"));
    }
  );
});
