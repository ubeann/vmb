import { describe, expect, it } from "vitest";
import { markMatches } from "./highlight.js";

describe("markMatches", () => {
  it("returns the text whole when nothing is searched", () => {
    expect(markMatches("Operations", "")).toEqual([{ text: "Operations", match: false }]);
    expect(markMatches("Operations", "   ")).toEqual([{ text: "Operations", match: false }]);
  });

  it("marks every match in the text's own case, whatever case was typed", () => {
    expect(markMatches("Fleet operations, OPS", "ops")).toEqual([
      { text: "Fleet operations, ", match: false },
      { text: "OPS", match: true }
    ]);
    expect(markMatches("Stop ops", "OP")).toEqual([
      { text: "St", match: false },
      { text: "op", match: true },
      { text: " ", match: false },
      { text: "op", match: true },
      { text: "s", match: false }
    ]);
  });

  it("treats the term as plain text, not a pattern", () => {
    expect(markMatches("a.b (c) [d] a*b", ".b")).toEqual([
      { text: "a", match: false },
      { text: ".b", match: true },
      { text: " (c) [d] a*b", match: false }
    ]);
    expect(markMatches("(c)", "(c")).toEqual([
      { text: "(c", match: true },
      { text: ")", match: false }
    ]);
    expect(markMatches("anything", "\\")).toEqual([{ text: "anything", match: false }]);
  });

  it("ignores the whitespace around the term, as the search does", () => {
    expect(markMatches("Fleet ops", "  ops ")).toEqual([
      { text: "Fleet ", match: false },
      { text: "ops", match: true }
    ]);
  });

  it("never loses or adds a character", () => {
    const text = "İstanbul ıi İİ";
    expect(
      markMatches(text, "i")
        .map((part) => part.text)
        .join("")
    ).toBe(text);
  });

  it("returns an empty text as no segments to mark", () => {
    expect(markMatches("", "ops")).toEqual([{ text: "", match: false }]);
  });
});
