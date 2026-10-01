// The moving parts of an etched plate (#243). prepare-etching.py cuts each
// part into its own mask and writes a manifest beside the masks: the part's
// box at rest, in percentages of the plate, and for a part that comes to rest
// away from where it was cut, that offset as a `translate` of its own size.

export type EtchedPart = { box: number[]; from?: number[]; origin?: number[] };

/** How far a travelling part falls to its rest, in % of the plate's height (0 if it doesn't travel). */
export function partLift(part: EtchedPart) {
  return part.from ? (-part.from[1]! / 100) * part.box[3]! : 0;
}

/**
 * Custom properties placing a part on its plate (`--x`, `--y`, `--w`, `--h`),
 * its masks for small and large screens (a plate with one size passes only
 * `small`), for a part that travels where it starts (`--from-x`, `--from-y`)
 * and the plate height it falls (`--lift`), and for a part that turns the point
 * it turns about (`--origin`).
 */
export function partStyle(part: EtchedPart, masks: { small: string; large?: string }) {
  const [x, y, w, h] = part.box as [number, number, number, number];
  const style = [
    `--x: ${x}%`,
    `--y: ${y}%`,
    `--w: ${w}%`,
    `--h: ${h}%`,
    `--mask-small: url(${masks.small})`
  ];
  if (masks.large) style.push(`--mask-large: url(${masks.large})`);
  if (part.origin) style.push(`--origin: ${part.origin[0]}% ${part.origin[1]}%`);
  if (part.from) {
    const [fromX, fromY] = part.from as [number, number];
    style.push(`--from-x: ${fromX}%`, `--from-y: ${fromY}%`, `--lift: ${partLift(part)}%`);
  }
  return style.join("; ");
}

/** A part's mask out of an `import.meta.glob` of `<plate>-<part>-<width>.webp`. */
export function partMask(urls: Record<string, string>, plate: string, part: string, width: number) {
  const url = Object.entries(urls).find(([path]) =>
    path.endsWith(`/${plate}-${part}-${width}.webp`)
  )?.[1];
  if (!url) throw new Error(`No ${width}px mask for ${plate} ${part}`);
  return url;
}

/** A part's two masks out of an `import.meta.glob` of `<plate>-<part>-{1200,2400}.webp`. */
export function partMasks(urls: Record<string, string>, plate: string, part: string) {
  return { small: partMask(urls, plate, part, 1200), large: partMask(urls, plate, part, 2400) };
}
