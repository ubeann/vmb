import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)));

// Canvas size from a WebP's VP8X header (cwebp writes one for any image with alpha).
function webpSize(file: Buffer) {
  expect(file.toString("ascii", 12, 16)).toBe("VP8X");
  return { width: file.readUIntLE(24, 3) + 1, height: file.readUIntLE(27, 3) + 1 };
}

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
