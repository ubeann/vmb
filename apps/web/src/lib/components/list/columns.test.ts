import { describe, expect, it } from "vitest";
import { columnClass, TEXT_TRUNCATE } from "./columns.js";

describe("the list column rule (ADR-0050)", () => {
  it("shrinks a utility column to its content", () => {
    expect(columnClass("utility")).toBe("w-px whitespace-nowrap");
  });

  it("shrinks a meta column too, and folds it under 32rem of card", () => {
    expect(columnClass("meta")).toBe("w-px whitespace-nowrap @max-lg/list:hidden");
  });

  it("lets the identity column take the card once rows fold to two lines, and truncate inside it", () => {
    expect(columnClass("identity")).toBe("@max-lg/list:w-full @max-lg/list:max-w-0");
  });

  it("gives free text the spare width down to 16ch, and folds it under 42rem of card", () => {
    const text = columnClass("text");
    expect(text).toContain("w-full max-w-0 min-w-[16ch]");
    expect(text).toContain("@max-2xl/list:hidden");
  });

  it("truncates the value inside a free-text cell", () => {
    expect(TEXT_TRUNCATE).toBe("block truncate");
  });
});
