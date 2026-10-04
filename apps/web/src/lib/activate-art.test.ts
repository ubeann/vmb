import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ACTIVATE_ART } from "./activate-art.js";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)));

// Canvas size from a WebP's VP8X header (cwebp writes one for any image with alpha).
function webpSize(file: Buffer) {
  expect(file.toString("ascii", 12, 16)).toBe("VP8X");
  return { width: file.readUIntLE(24, 3) + 1, height: file.readUIntLE(27, 3) + 1 };
}

// The mark's box takes its aspect ratio from here, so a stale ratio squashes the art.
describe("activate art ratios", () => {
  it.each(Object.entries(ACTIVATE_ART))("%s matches its mask", (_name, { ratio, file }) => {
    const { width, height } = webpSize(read(`./assets/activate/${file}`));
    expect(ratio).toBeCloseTo(width / height, 2);
  });
});
