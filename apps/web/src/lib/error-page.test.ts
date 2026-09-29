import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ERROR_SCENES, errorPageContent, supportMailtoQuery } from "./error-page.js";

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
    expect(content.title).toBe("Unable to load this page");
    expect(content.body).toBe("Try again, or come back in a few minutes.");
    expect(content.scene.name).toBe("crates");
    expect(content.canRetry).toBe(true);
  });

  it("gives other client errors the generic copy, without a retry", () => {
    const content = errorPageContent(400);
    expect(content.title).toBe("Unable to load this page");
    expect(content.body).not.toContain("Try again");
    expect(content.canRetry).toBe(false);
  });
});

describe("supportMailtoQuery", () => {
  it("puts the reference in the subject and the reference, page and time in the body", () => {
    const params = new URLSearchParams(
      supportMailtoQuery({
        errorId: "3f9a1c2e",
        path: "/warehouse/items",
        occurredAt: "2026-09-29T09:22:41.000Z"
      })
    );

    expect(params.get("subject")).toBe("VMB error 3f9a1c2e");
    expect(params.get("body")).toBe(
      "Reference: 3f9a1c2e\r\nPage: /warehouse/items\r\nTime: 2026-09-29 09:22 UTC\r\n\r\nWhat were you doing when this happened?\r\n"
    );
  });

  it("encodes spaces as %20, which every mail client reads", () => {
    expect(supportMailtoQuery({ errorId: "3f9a1c2e", path: "/" })).toMatch(
      /^subject=VMB%20error%203f9a1c2e&body=/
    );
  });

  it("leaves the time out when it is unknown", () => {
    const params = new URLSearchParams(supportMailtoQuery({ errorId: "3f9a1c2e", path: "/" }));
    expect(params.get("body")).not.toContain("Time:");
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
