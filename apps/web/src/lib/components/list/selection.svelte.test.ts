import { describe, expect, it } from "vitest";
import { Selection } from "./selection.svelte.js";

describe("Selection", () => {
  it("starts empty and counts what is chosen", () => {
    const selection = new Selection();
    expect(selection.count).toBe(0);

    selection.toggle("a");
    selection.toggle("b");
    expect(selection.count).toBe(2);
    expect(selection.has("a")).toBe(true);
    expect(selection.has("c")).toBe(false);

    selection.toggle("a");
    expect(selection.has("a")).toBe(false);
    expect(selection.ids).toEqual(["b"]);
  });

  it("sets one row on or off explicitly, which a checkbox's own state does", () => {
    const selection = new Selection();
    selection.toggle("a", true);
    selection.toggle("a", true);
    expect(selection.count).toBe(1);
    selection.toggle("a", false);
    selection.toggle("a", false);
    expect(selection.count).toBe(0);
  });

  it("reads a page as none, some or all of it selected", () => {
    const selection = new Selection();
    const page = ["a", "b", "c"];
    expect(selection.stateOf(page)).toBe("none");
    expect(selection.stateOf([])).toBe("none");

    selection.toggle("b");
    expect(selection.stateOf(page)).toBe("some");

    selection.setPage(page, true);
    expect(selection.stateOf(page)).toBe("all");
    expect(selection.count).toBe(3);
  });

  it("selects the page it is given and no other: select all is the current page only", () => {
    const selection = new Selection();
    selection.setPage(["a", "b"], true);
    selection.setPage(["a", "b"], false);
    expect(selection.count).toBe(0);
  });

  it("keeps only the ids still on the page, in the order they were chosen", () => {
    const selection = new Selection();
    selection.toggle("c");
    selection.toggle("a");
    selection.toggle("z");

    selection.keep(["a", "b", "c"]);

    expect(selection.ids).toEqual(["c", "a"]);
  });

  it("clears", () => {
    const selection = new Selection();
    selection.setPage(["a", "b"], true);
    selection.clear();
    expect(selection.count).toBe(0);
    expect(selection.ids).toEqual([]);
  });
});
