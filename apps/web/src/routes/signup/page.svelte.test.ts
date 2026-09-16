import { describe, expect, it, vi } from "vitest";

vi.mock("$app/forms", () => ({
  enhance: () => ({ destroy() {} })
}));
vi.mock("$app/paths", () => ({
  resolve: (path: string) => path
}));

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

describe("signup page", () => {
  it("renders the name/email/password form with no error by default", async () => {
    const screen = await render(Page, { form: null });

    await expect.element(screen.getByRole("heading", { name: "Sign up" })).toBeVisible();
    await expect.element(screen.getByLabelText("Name")).toBeVisible();
    await expect.element(screen.getByLabelText("Email")).toBeVisible();
    await expect.element(screen.getByLabelText("Password")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Sign up" })).toBeVisible();
    expect(screen.getByRole("alert").elements()).toHaveLength(0);
  });

  it("shows the server action's error message", async () => {
    const screen = await render(Page, { form: { error: "Could not create account." } });

    await expect.element(screen.getByRole("alert")).toHaveTextContent("Could not create account.");
  });

  it("shows a check-your-email message instead of the form on success", async () => {
    const screen = await render(Page, { form: { success: true } });

    await expect.element(screen.getByText(/check your email/i)).toBeVisible();
    expect(screen.getByLabelText("Email").elements()).toHaveLength(0);
  });

  it("links to the login page", async () => {
    const screen = await render(Page, { form: null });

    await expect.element(screen.getByRole("link", { name: "Log in" })).toBeVisible();
  });
});
