import { describe, expect, it, vi } from "vitest";

vi.mock("$app/forms", () => ({
  enhance: () => ({ destroy() {} })
}));
vi.mock("$app/paths", () => ({
  resolve: (path: string) => path
}));
vi.mock("$app/state", () => ({
  page: { url: new URL("http://localhost/activate") }
}));

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

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

  it("shows a visible error when the hidden email is missing on the code step", async () => {
    const screen = await render(Page, {
      form: {
        step: "reset",
        email: "",
        error: "Email, code, and new password are required.",
        fieldErrors: { email: "Email is required." }
      }
    });

    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Email, code, and new password are required.");
  });
});
