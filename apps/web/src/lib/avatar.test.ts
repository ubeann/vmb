import { describe, expect, it } from "vitest";
import { placeholderAvatar } from "./avatar.js";

const svg = (uri: string) =>
  decodeURIComponent(uri.replace(/^data:image\/svg\+xml;charset=utf-8,/, ""));

describe("placeholderAvatar", () => {
  it("draws the initials of the name as an SVG data URI", () => {
    const uri = placeholderAvatar("Siti Rahma");

    expect(uri).toMatch(/^data:image\/svg\+xml/);
    expect(svg(uri)).toContain(">SR<");
  });

  it("gives the same name the same picture every time", () => {
    expect(placeholderAvatar("Siti Rahma")).toBe(placeholderAvatar("Siti Rahma"));
  });

  it("tells different people apart", () => {
    expect(placeholderAvatar("Siti Rahma")).not.toBe(placeholderAvatar("Budi Santoso"));
  });
});
