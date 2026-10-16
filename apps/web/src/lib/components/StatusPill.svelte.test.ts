import { describe, expect, it } from "vitest";

const { render } = await import("vitest-browser-svelte");
const { default: StatusPill } = await import("./StatusPill.svelte");

describe("StatusPill", () => {
  it("says the status in words and takes its tone from the one map", async () => {
    const active = await render(StatusPill, { status: "Active" });
    await expect.element(active.getByText("Active")).toHaveAttribute("data-tone", "success");

    const suspended = await render(StatusPill, { status: "Suspended" });
    await expect.element(suspended.getByText("Suspended")).toHaveAttribute("data-tone", "warning");

    const inactive = await render(StatusPill, { status: "Inactive" });
    await expect.element(inactive.getByText("Inactive")).toHaveAttribute("data-tone", "neutral");
  });
});
