import { afterEach, describe, expect, it } from "vitest";

// Isolated renders don't load the global stylesheet; the skin, corners and legacy layer come from it.
import "../app.css";

import { render } from "vitest-browser-svelte";
import ControlSkin from "./control-skin-fixture.svelte";

afterEach(() => document.documentElement.classList.remove("dark"));

const style = (element: Element) => getComputedStyle(element);

/** A colour as the browser resolves it, for comparing against computed styles. */
function resolved(color: string): string {
  const probe = document.createElement("span");
  probe.style.color = color;
  document.body.append(probe);
  const value = style(probe).color;
  probe.remove();
  return value;
}

async function controls() {
  const screen = await render(ControlSkin);
  return {
    search: screen.getByRole("searchbox", { name: "Search" }).element(),
    filter: screen.getByRole("button", { name: "Filter" }).element(),
    columns: screen.getByRole("button", { name: "Columns" }).element(),
    select: screen.getByLabelText("Rows per page").element()
  };
}

// ADR-0035's 2026-10-11 amendment: one skin for text fields and outline buttons.
describe("the control skin", () => {
  it("puts fields and outline buttons on the paper with the halfway edge, in light mode", async () => {
    const { search, filter, columns, select } = await controls();
    const edge = resolved("color-mix(in oklab, var(--input) 45%, var(--border))");
    const paper = resolved("var(--background)");

    for (const control of [search, filter, columns, select]) {
      expect(style(control).borderTopColor).toBe(edge);
      expect(style(control).backgroundColor).toBe(paper);
    }
  });

  it("keeps the dark look: the --input edge on a tint of it", async () => {
    document.documentElement.classList.add("dark");
    const { search, filter, columns } = await controls();
    const edge = resolved("var(--input)");

    for (const control of [search, filter, columns]) {
      expect(style(control).borderTopColor).toBe(edge);
    }
    expect(style(filter).backgroundColor).toBe(style(search).backgroundColor);
  });

  it("rounds 32px controls by a quarter of their height", async () => {
    const { search, filter, columns, select } = await controls();

    for (const control of [search, filter, columns, select]) {
      expect(control.getBoundingClientRect().height).toBe(32);
      expect(style(control).borderTopLeftRadius).toBe("8px");
    }
  });

  it("lets a caller's corner replace the control corner", async () => {
    const screen = await render(ControlSkin);
    const pill = screen.getByRole("button", { name: "Pill" }).element();

    expect(pill.className).not.toContain("--control-radius");
    expect(style(pill).borderTopLeftRadius).not.toBe("8px");
  });

  it("keeps the button slot on a dropdown trigger, so touch pointers size it", async () => {
    const { columns } = await controls();

    expect(columns.getAttribute("data-slot")).toBe("button");
    expect(columns.getAttribute("aria-haspopup")).toBe("menu");
  });
});

describe("the legacy layer", () => {
  it("leaves kit elements with a data-slot alone", async () => {
    const screen = await render(ControlSkin);
    const term = screen.getByText("Term").element();
    const detail = screen.getByText("Detail").element();
    const label = screen.getByText("Label").element();

    expect(style(term).fontWeight).toBe("400");
    expect(style(detail).marginInlineStart).toBe("0px");
    expect(style(term.parentElement!).marginBlockStart).toBe("0px");
    expect(style(label).display).toBe("inline");
  });
});
