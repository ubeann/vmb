import { UserCreateInputSchema } from "@vmb/types";
import { setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it } from "vitest";
import type { PageData } from "./$types.js";

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

const pageData = async () =>
  ({
    form: await superValidate(zod4(UserCreateInputSchema), { errors: false }),
    roles: [{ id: "r1", name: "Staff", divisionName: null, divisionInactive: false }]
  }) as unknown as PageData;

describe("the new user page", () => {
  it("is a full page with the three sections, Create, and a Cancel back to the list", async () => {
    const screen = await render(Page, { data: await pageData() });

    await expect.element(screen.getByRole("heading", { name: "New user", level: 1 })).toBeVisible();
    await expect.element(screen.getByRole("group", { name: "Personal details" })).toBeVisible();
    await expect.element(screen.getByRole("group", { name: "Authorization" })).toBeVisible();
    await expect.element(screen.getByRole("group", { name: "Security" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Create user" })).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Cancel" }))
      .toHaveAttribute("href", "/master/users");
  });

  it("asks for the password and its repeat, with the length reading", async () => {
    const screen = await render(Page, { data: await pageData() });

    await expect.element(screen.getByLabelText("Password", { exact: true })).toBeVisible();
    await expect.element(screen.getByLabelText("Confirm password")).toBeVisible();
    await expect
      .element(screen.getByRole("meter", { name: "Password length" }))
      .toHaveAttribute("aria-valuetext", "At least 12 characters");
  });

  it("shows the API's refusals on the fields they name", async () => {
    const data = await pageData();
    setError(data.form, "password", "That password has appeared in a data breach.");
    setError(data.form, "email", "A user with that email already exists.");

    const screen = await render(Page, { data });

    await expect
      .element(screen.getByText("That password has appeared in a data breach."))
      .toBeVisible();
    await expect.element(screen.getByText("A user with that email already exists.")).toBeVisible();
  });
});
