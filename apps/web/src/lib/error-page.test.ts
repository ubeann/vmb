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
  it.each(Object.values(ERROR_SCENES))("match vmb-error-$name-840.webp", ({ name, ratio }) => {
    const { width, height } = webpSize(read(`./assets/errors/vmb-error-${name}-840.webp`));
    expect(ratio).toBeCloseTo(width / height, 2);
  });
});

// The parts (#244) are placed in plate percentages from the manifest
// prepare-etching.py writes beside the masks, so the manifest, the plate and
// every part's mask have to come from the same run.
type Box = [left: number, top: number, width: number, height: number];
type Manifest = {
  plate: [width: number, height: number];
  parts: Record<string, { box: Box; origin?: [x: number, y: number] }>;
};
const manifest = (name: string): Manifest =>
  JSON.parse(read(`./assets/errors/vmb-error-${name}-parts.json`).toString()) as Manifest;

describe.each(Object.values(ERROR_SCENES))("$name vignette parts", (scene) => {
  const { plate, parts } = manifest(scene.name);
  const entries = Object.entries(parts);

  it("share the plate's ratio", () => {
    expect(plate[0] / plate[1]).toBeCloseTo(scene.ratio, 2);
  });

  it("are the manifest's parts, each with its own mask", () => {
    expect(Object.keys(scene.parts).sort()).toEqual(Object.keys(parts).sort());
  });

  it.each(entries)("draw %s from a mask the size of its box", (part, { box }) => {
    const file = webpSize(read(`./assets/errors/vmb-error-${scene.name}-${part}-840.webp`));
    const plateWidth = webpSize(read(`./assets/errors/vmb-error-${scene.name}-840.webp`)).width;
    const scale = plateWidth / plate[0];
    expect(Math.abs(file.width - (box[2] / 100) * plate[0] * scale)).toBeLessThanOrEqual(1);
    expect(Math.abs(file.height - (box[3] / 100) * plate[1] * scale)).toBeLessThanOrEqual(1);
  });

  it.each(entries)("rest %s inside the plate", (_, { box }) => {
    const [left, top, width, height] = box;
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(left + width).toBeLessThanOrEqual(100.01);
    expect(top + height).toBeLessThanOrEqual(100.01);
  });
});

describe("road parts", () => {
  const { truck } = manifest("road").parts;

  it("start the truck on the road, left of the signpost, to drive off to the left", () => {
    const [left, top, width, height] = truck!.box;
    expect(left).toBeGreaterThan(20);
    expect(left + width).toBeLessThan(55);
    expect(top).toBeGreaterThan(50);
    expect(top + height).toBeLessThan(80);
  });

  it("hide the plate behind the truck", () => {
    expect(ERROR_SCENES.road.parts.truck!.opaque).toBe(true);
  });
});

describe("gate parts", () => {
  const { "leaf-left": left, "leaf-right": right, lock } = manifest("gate").parts;

  it("hang the leaves from the pillars, meeting at the middle of the gate", () => {
    expect(left!.box[0] + left!.box[2]).toBeGreaterThanOrEqual(right!.box[0]);
    expect(left!.box[0]).toBeLessThan(right!.box[0]);
    expect(left!.box[1]).toBeCloseTo(right!.box[1], 0);
    expect(left!.box[3]).toBeCloseTo(right!.box[3], 0);
  });

  it("chain the lock across the seam between the leaves", () => {
    const seam = right!.box[0];
    expect(lock!.box[0]).toBeLessThan(seam);
    expect(lock!.box[0] + lock!.box[2]).toBeGreaterThan(seam);
  });

  it("draw the leaves over the yard, so only the lock and the leaves' ink show", () => {
    expect(ERROR_SCENES.gate.parts["leaf-left"]!.opaque).toBe(false);
    expect(ERROR_SCENES.gate.parts["leaf-right"]!.opaque).toBe(false);
  });
});

describe("crates parts", () => {
  const { stack, crate } = manifest("crates").parts;

  it("turn the stack about its foot and the crate about its base", () => {
    expect(stack!.origin![1]).toBeGreaterThan(90);
    expect(stack!.origin![1]).toBeLessThan(110);
    expect(crate!.origin![1]).toBeGreaterThan(80);
    expect(crate!.origin![1]).toBeLessThan(110);
  });

  it("land the crate on the pile at the foot of the stack, to its left", () => {
    expect(crate!.box[0] + crate!.box[2] / 2).toBeLessThan(stack!.box[0] + stack!.box[2] / 2);
    expect(crate!.box[1]).toBeGreaterThan(stack!.box[1] + stack!.box[3] / 2);
  });

  it("hide the plate behind both", () => {
    expect(ERROR_SCENES.crates.parts.stack!.opaque).toBe(true);
    expect(ERROR_SCENES.crates.parts.crate!.opaque).toBe(true);
  });
});
