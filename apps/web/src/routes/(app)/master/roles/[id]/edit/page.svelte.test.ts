import { RoleUpdateInputSchema, type RoleDetail } from "@vmb/types";
import { setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it } from "vitest";
import type { PageData } from "./$types.js";

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

const STAMP = "2026-10-05T03:04:00.123Z";
const ID = "d1000000-0000-4000-8000-000000000001";
const role: RoleDetail = {
  id: ID,
  name: "Staff",
  isActive: true,
  isSystem: false,
  colorHex: "#805AD5",
  iconName: "user",
  description: null,
  divisionId: null,
  divisionName: null,
  divisionInactive: false,
  userCount: 0,
  permissionCount: 0,
  grantable: true,
  permissionKeys: [],
  createdAt: STAMP,
  updatedAt: STAMP
};

async function pageData(overrides: Record<string, unknown> = {}) {
  const form = await superValidate(
    {
      ...{
        name: "Staff",
        description: "",
        colorHex: "#805AD5",
        iconName: "user",
        isActive: true,
        updatedAt: STAMP
      },
      ...overrides
    },
    zod4(RoleUpdateInputSchema)
  );
  return { role, form, divisions: [] } as unknown as PageData;
}

describe("the role edit page", () => {
  it("sends the updatedAt it loaded", async () => {
    await render(Page, { data: await pageData() });

    expect(document.querySelector<HTMLInputElement>('input[name="updatedAt"]')?.value).toBe(STAMP);
  });

  it("keeps the input on a stale save and links to a reload of this page", async () => {
    const data = await pageData({ name: "My edit" });
    setError(
      data.form,
      "updatedAt",
      "This record was changed by someone else since you opened it."
    );

    const screen = await render(Page, { data });

    await expect.element(screen.getByRole("alert")).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Reload" }))
      .toHaveAttribute("href", "/master/roles/d1000000-0000-4000-8000-000000000001/edit");
    await expect.element(screen.getByRole("textbox", { name: "Name" })).toHaveValue("My edit");
  });
});
