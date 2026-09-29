import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ERROR_SCENES, errorPageContent } from "./error-page.js";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)));

// Canvas size from a WebP's VP8X header (cwebp writes one for any image with alpha).
function webpSize(file: Buffer) {
  expect(file.toString("ascii", 12, 16)).toBe("VP8X");
  return { width: file.readUIntLE(24, 3) + 1, height: file.readUIntLE(27, 3) + 1 };
}

describe("errorPageContent", () => {
  it.each([404, 410])("sends %i to the lost road", (status) => {
    const content = errorPageContent(status);
    expect(content.title).toBe("Page not found");
    expect(content.scene.name).toBe("road");
    expect(content.canRetry).toBe(false);
  });

  it.each([401, 403])("sends %i to the locked gate", (status) => {
    const content = errorPageContent(status);
    expect(content.title).toBe("No access to this page");
    expect(content.scene.name).toBe("gate");
    expect(content.canRetry).toBe(false);
  });

  it.each([500, 502, 503])("sends %i to the toppled crates, with a retry", (status) => {
    const content = errorPageContent(status);
    expect(content.title).toBe("Something went wrong");
    expect(content.scene.name).toBe("crates");
    expect(content.canRetry).toBe(true);
  });

  it("gives other client errors the generic copy, without a retry", () => {
    const content = errorPageContent(400);
    expect(content.title).toBe("Something went wrong");
    expect(content.canRetry).toBe(false);
  });
});

// The vignette box takes its aspect ratio from the scene, so a stale ratio
// squashes the art.
describe("error scene ratios", () => {
  it.each(Object.values(ERROR_SCENES))("match vmb-error-$name.webp", ({ name, ratio }) => {
    const { width, height } = webpSize(read(`./assets/errors/vmb-error-${name}.webp`));
    expect(ratio).toBeCloseTo(width / height, 2);
  });
});
