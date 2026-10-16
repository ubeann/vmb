import { DivisionUpdateInputSchema, type Division } from "@vmb/types";
import { setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it } from "vitest";
import type { PageData } from "./$types.js";

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

const STAMP = "2026-10-05T03:04:00.123Z";
const ID = "d1000000-0000-4000-8000-000000000001";
const division: Division = {
  id: ID,
  name: "Operations",
  code: "OPS",
  description: null,
  colorHex: "#2563EB",
  iconName: "settings",
  isActive: true,
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null
};

async function pageData(overrides: Record<string, unknown> = {}) {
  const form = await superValidate(
    {
      ...{
        name: "Operations",
        code: "OPS",
        description: "",
        colorHex: "#2563EB",
        iconName: "settings",
        isActive: true,
        updatedAt: STAMP
      },
      ...overrides
    },
    zod4(DivisionUpdateInputSchema)
  );
  return { division, form } as unknown as PageData;
}

describe("the division edit page", () => {
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
      .toHaveAttribute("href", "/master/divisions/d1000000-0000-4000-8000-000000000001/edit");
    await expect.element(screen.getByRole("textbox", { name: "Name" })).toHaveValue("My edit");
  });
});
