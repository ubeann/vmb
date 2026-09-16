import { describe, expect, it, vi } from "vitest";

const mockPage: { url: URL } = { url: new URL("http://localhost/login") };

vi.mock("$app/forms", () => ({
  enhance: () => ({ destroy() {} })
}));
vi.mock("$app/paths", () => ({
  resolve: (path: string) => path
}));
vi.mock("$app/state", () => ({
  page: mockPage
}));

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

describe("login page", () => {
  it("renders the email/password form with no error or verified banner by default", async () => {
    mockPage.url = new URL("http://localhost/login");

    const screen = await render(Page, { form: null });

    await expect.element(screen.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect.element(screen.getByLabelText("Email")).toBeVisible();
    await expect.element(screen.getByLabelText("Password")).toBeVisible();
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

  it("links to the signup page", async () => {
    mockPage.url = new URL("http://localhost/login");

    const screen = await render(Page, { form: null });

    await expect.element(screen.getByRole("link", { name: "Sign up" })).toBeVisible();
  });
});
