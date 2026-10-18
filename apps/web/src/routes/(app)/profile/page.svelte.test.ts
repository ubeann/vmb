import { ProfileUpdateInputSchema } from "@vmb/types";
import { setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it } from "vitest";
import "../../../app.css";
import { axeViolations } from "$lib/a11y-support.js";
import type { PageData } from "./$types.js";

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

const STAMP = "2026-10-05T03:04:00.123Z";

async function pageData(
  overrides: Record<string, unknown> = {},
  fields: Record<string, unknown> = {}
) {
  const form = await superValidate(
    { name: "Rina Wijaya", phone: "+628111000001", profilePhotoPath: "", ...fields },
    zod4(ProfileUpdateInputSchema)
  );
  return {
    email: "rina@vmblogistics.id",
    saved: false,
    stamp: STAMP,
    form,
    ...overrides
  } as unknown as PageData;
}

describe("the profile page", () => {
  it("edits the name, phone and photo link, with no email field", async () => {
    const screen = await render(Page, { data: await pageData() });

    await expect.element(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Rina Wijaya");
    await expect
      .element(screen.getByRole("textbox", { name: "Phone number" }))
      .toHaveValue("+628111000001");
    await expect.element(screen.getByRole("textbox", { name: /Photo link/ })).toHaveValue("");
    expect(document.querySelector('[name="email"]')).toBeNull();
    expect(screen.getByRole("textbox", { name: "Email" }).elements()).toHaveLength(0);
  });

  it("shows the email as text with the way to change it", async () => {
    const screen = await render(Page, { data: await pageData() });

    await expect.element(screen.getByText("rina@vmblogistics.id")).toBeVisible();
    await expect.element(screen.getByText("Ask an administrator to change it.")).toBeVisible();
  });

  it("says a save happened only when it was sent back saved", async () => {
    const quiet = await render(Page, { data: await pageData() });
    expect(quiet.getByText("Your profile is saved.").elements()).toHaveLength(0);
    quiet.unmount();

    const saved = await render(Page, { data: await pageData({ saved: true }) });
    await expect.element(saved.getByRole("status")).toHaveTextContent("Your profile is saved.");
  });

  it("keeps the input and shows the API's refusal under the field it names", async () => {
    const data = await pageData({}, { name: "My edit" });
    setError(data.form, "phone", "Phone must be an Indonesian number such as +6281234567890.");

    const screen = await render(Page, { data });

    await expect.element(screen.getByRole("textbox", { name: "Name" })).toHaveValue("My edit");
    await expect
      .element(screen.getByText("Phone must be an Indonesian number such as +6281234567890."))
      .toBeVisible();
  });

  it("offers Save profile and a Cancel back to the dashboard", async () => {
    const screen = await render(Page, { data: await pageData() });

    await expect.element(screen.getByRole("button", { name: "Save profile" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/");
  });

  it("titles its section one level under the page heading", async () => {
    const screen = await render(Page, { data: await pageData() });

    await expect.element(screen.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
    await expect
      .element(screen.getByRole("heading", { level: 2, name: "Personal information" }))
      .toBeVisible();
  });

  it("has no accessibility violations, saved or refused", async () => {
    const saved = await render(Page, { data: await pageData({ saved: true }) });

    await expect.element(saved.getByRole("heading", { name: "Profile" })).toBeVisible();
    expect(await axeViolations(document.body)).toEqual([]);
    saved.unmount();

    const data = await pageData();
    setError(data.form, "phone", "Phone must be an Indonesian number such as +6281234567890.");
    const refused = await render(Page, { data });

    await expect.element(refused.getByText(/Phone must be/)).toBeVisible();
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
