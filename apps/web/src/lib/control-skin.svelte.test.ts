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
    view: screen.getByRole("button", { name: "View" }).element(),
    select: screen.getByLabelText("Rows per page").element(),
    email: screen.getByRole("textbox", { name: "Email" }).element(),
    division: screen.getByLabelText("Division").element()
  };
}

// ADR-0035's 2026-10-11 amendment: one skin for outline buttons and the list kit's fields.
describe("the control skin", () => {
  it("puts kit fields and outline buttons on the card, white, with the halfway edge, in light mode", async () => {
    const { search, filter, view, select } = await controls();
    const edge = resolved("color-mix(in oklab, var(--input) 45%, var(--border))");
    const card = resolved("var(--card)");

    for (const control of [search, filter, view, select]) {
      expect(style(control).borderTopColor).toBe(edge);
      expect(style(control).backgroundColor).toBe(card);
      // a soft shadow under it, as a field on a white card has nothing else to stand on
      expect(style(control).boxShadow).not.toBe("none");
    }
  });

  it("keeps form fields clear, white on their card, with the 3:1 --input edge", async () => {
    const { email, division } = await controls();

    for (const field of [email, division]) {
      expect(style(field).borderTopColor).toBe(resolved("var(--input)"));
      expect(style(field).backgroundColor).toBe("rgba(0, 0, 0, 0)");
      expect(style(field).borderTopLeftRadius).toBe("8px");
    }
  });

  it("keeps the dark look: the --input edge on a tint of it", async () => {
    document.documentElement.classList.add("dark");
    const { search, filter, view } = await controls();
    const edge = resolved("var(--input)");

    for (const control of [search, filter, view]) {
      expect(style(control).borderTopColor).toBe(edge);
    }
    expect(style(filter).backgroundColor).toBe(style(search).backgroundColor);
  });

  it("makes default controls 36px, with an 8px corner", async () => {
    const { search, filter, view, select } = await controls();

    for (const control of [search, filter, view, select]) {
      expect(control.getBoundingClientRect().height).toBe(36);
      expect(style(control).borderTopLeftRadius).toBe("8px");
    }
  });

  it("lets a caller's corner replace the control corner", async () => {
    const screen = await render(ControlSkin);
    const pill = screen.getByRole("button", { name: "Pill" }).element();

    expect(pill.className).not.toContain("--control-radius");
    expect(style(pill).borderTopLeftRadius).not.toBe("8px");
  });

  it("keeps the button slot on a layer trigger, so touch pointers size it", async () => {
    const { view } = await controls();

    expect(view.getAttribute("data-slot")).toBe("button");
    expect(view.getAttribute("aria-haspopup")).toBe("dialog");
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
