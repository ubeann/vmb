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
      .element(footer.getByRole("link", { name: "vmb_operation@vifieraminova.com", exact: true }))
      .toHaveAttribute("href", "mailto:vmb_operation@vifieraminova.com");
    await expect
      .element(footer.getByRole("link", { name: "ubeann", exact: true }))
      .toHaveAttribute("href", "https://github.com/ubeann");
    expect(footer.element().textContent).toMatch(
      /Support team:\s+vmb_operation@vifieraminova\.com/
    );
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
});
