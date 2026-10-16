import { describe, expect, it } from "vitest";
import { SWATCHES } from "../../master/appearance.js";
import {
  contrastWithWhite,
  darkerShade,
  HARD_TO_SEE_BELOW,
  hexToHsv,
  hsvToHex,
  READABLE_AT
} from "./color.js";

describe("hexToHsv and hsvToHex", () => {
  it("reads a colour's hue, saturation and brightness", () => {
    expect(hexToHsv("#FF0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#00FF00")).toEqual({ h: 120, s: 1, v: 1 });
    expect(hexToHsv("#000080")).toEqual({ h: 240, s: 1, v: 128 / 255 });
    // a grey has no saturation, and so no hue of its own
    expect(hexToHsv("#808080")).toEqual({ h: 0, s: 0, v: 128 / 255 });
  });

  it("gives back every swatch it reads, in upper case", () => {
    for (const { hex } of SWATCHES) expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    expect(hsvToHex(hexToHsv("#0d9488"))).toBe("#0D9488");
  });
});

describe("contrastWithWhite", () => {
  it("measures as WCAG does", () => {
    expect(contrastWithWhite("#000000")).toBeCloseTo(21, 5);
    expect(contrastWithWhite("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("flags a pale tint, and none of the swatches", () => {
    expect(contrastWithWhite("#FDE68A")).toBeLessThan(HARD_TO_SEE_BELOW);
    for (const { hex } of SWATCHES) {
      expect(contrastWithWhite(hex)).toBeGreaterThanOrEqual(HARD_TO_SEE_BELOW);
    }
  });
});

describe("darkerShade", () => {
  it("darkens a pale colour just enough to read, keeping its hue", () => {
    for (const pale of ["#FDE68A", "#25CAEB", "#BBF7D0", "#FFFFFF"]) {
      const shade = darkerShade(pale);
      expect(contrastWithWhite(shade)).toBeGreaterThanOrEqual(READABLE_AT);
      // no darker than it needs to be
      expect(contrastWithWhite(shade)).toBeLessThan(READABLE_AT + 0.25);
      if (hexToHsv(pale).s > 0) expect(hexToHsv(shade).h).toBeCloseTo(hexToHsv(pale).h, -1);
    }
  });

  it("keeps a colour that already reads", () => {
    expect(darkerShade("#2563EB")).toBe("#2563EB");
  });
});
