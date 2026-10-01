import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)));

// Canvas size from a WebP's VP8X header (cwebp writes one for any image with alpha).
function webpSize(file: Buffer) {
  expect(file.toString("ascii", 12, 16)).toBe("VP8X");
  return { width: file.readUIntLE(24, 3) + 1, height: file.readUIntLE(27, 3) + 1 };
}

type Box = [left: number, top: number, width: number, height: number];
type Manifest = {
  plate: [width: number, height: number];
  parts: Record<string, { box: Box; from?: [x: number, y: number] }>;
};
const manifest = (name: string): Manifest =>
  JSON.parse(read(`../assets/auth/${name}-parts.json`).toString()) as Manifest;

// EtchedScene fits the plate to the band's height and sizes the band from
// `--plate-ratio`, so a stale ratio crops the plate or shows its ends (#219).
describe("EtchedScene plate ratio", () => {
  const scene = read("./EtchedScene.svelte").toString();
  const ratio = Number(scene.match(/--plate-ratio:\s*([\d.]+);/)?.[1]);

  it.each(["vmb-etching-2400.webp", "vmb-etching-1200.webp"])("matches %s", (name) => {
    const { width, height } = webpSize(read(`../assets/auth/${name}`));
    expect(ratio).toBeCloseTo(width / height, 2);
  });
});

// EtchedSky rebuilds the sky's `cover` crop as a box of `--sky-ratio`, and
// places its parts in that box, so a stale ratio misplaces them (#243).
describe("EtchedSky ratio", () => {
  const sky = read("./EtchedSky.svelte").toString();
  const ratio = Number(sky.match(/--sky-ratio:\s*([\d.]+);/)?.[1]);

  it.each(["vmb-sky-2400.webp", "vmb-sky-1200.webp"])("matches %s", (name) => {
    const { width, height } = webpSize(read(`../assets/auth/${name}`));
    expect(ratio).toBeCloseTo(width / height, 2);
  });
});

// The moving parts (#243) are placed in plate percentages from the manifest
// prepare-etching.py writes beside the masks, so the manifest, the plate and
// every part's mask have to come from the same run.
describe.each(["vmb-etching", "vmb-sky"])("%s moving parts", (name) => {
  const { plate, parts } = manifest(name);
  const entries = Object.entries(parts);

  it.each([2400, 1200])("share the plate's ratio at %ipx", (width) => {
    const file = webpSize(read(`../assets/auth/${name}-${width}.webp`));
    expect(plate[0] / plate[1]).toBeCloseTo(file.width / file.height, 2);
  });

  it.each(
    entries.flatMap(([part, { box }]) => [2400, 1200].map((width) => [part, width, box] as const))
  )("draw %s from a %ipx mask the size of its box", (part, width, box) => {
    const file = webpSize(read(`../assets/auth/${name}-${part}-${width}.webp`));
    const scale = width / plate[0];
    expect(Math.abs(file.width - (box[2] / 100) * plate[0] * scale)).toBeLessThanOrEqual(1);
    expect(Math.abs(file.height - (box[3] / 100) * plate[1] * scale)).toBeLessThanOrEqual(1);
  });

  it.each(entries)("rest %s inside the plate", (_, { box }) => {
    const [left, top, width, height] = box;
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(left + width).toBeLessThanOrEqual(100);
    expect(top + height).toBeLessThanOrEqual(100);
  });
});

describe("landscape parts", () => {
  const { parts } = manifest("vmb-etching");
  const bottom = (part: string) => parts[part]!.box[1] + parts[part]!.box[3];

  it("rest the three trucks on the bridge deck, in a row from left to right", () => {
    expect(bottom("truck-2")).toBeCloseTo(bottom("truck-1"), 1);
    expect(bottom("truck-3")).toBeCloseTo(bottom("truck-1"), 1);
    expect(parts["truck-1"]!.box[0]).toBeLessThan(parts["truck-2"]!.box[0]);
    expect(parts["truck-2"]!.box[0]).toBeLessThan(parts["truck-3"]!.box[0]);
  });

  it("lower the container from the crane's boom onto the yard", () => {
    const [, top, , height] = parts.container!.box;
    const lift = (-parts.container!.from![1] / 100) * height;
    expect(lift).toBeGreaterThan(height);
    expect(top - lift).toBeGreaterThanOrEqual(0);
  });

  it("keep the water's light under the bridge, below the trucks", () => {
    expect(parts.water!.box[1]).toBeGreaterThan(bottom("truck-1"));
  });
});
