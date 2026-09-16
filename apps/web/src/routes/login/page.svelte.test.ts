import { describe, expect, it, vi } from "vitest";

vi.mock("$app/forms", () => ({
  enhance: () => ({ destroy() {} })
}));
vi.mock("$app/paths", () => ({
  resolve: (path: string) => path
}));

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

describe("login page", () => {
  it("renders the email/password form with no error by default", async () => {
    const screen = await render(Page, { form: null });

    await expect.element(screen.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect.element(screen.getByLabelText("Email")).toBeVisible();
    await expect.element(screen.getByLabelText("Password")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Log in" })).toBeVisible();
    expect(screen.getByRole("alert").elements()).toHaveLength(0);
  });

  it("shows the server action's error message", async () => {
    const screen = await render(Page, { form: { error: "Invalid email or password." } });

    await expect.element(screen.getByRole("alert")).toHaveTextContent("Invalid email or password.");
  });

  it("links to the signup page", async () => {
    const screen = await render(Page, { form: null });

    await expect.element(screen.getByRole("link", { name: "Sign up" })).toBeVisible();
  });
});
