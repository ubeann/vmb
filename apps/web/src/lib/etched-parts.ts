// The moving parts of an etched plate (#243). prepare-etching.py cuts each
// part into its own mask and writes a manifest beside the masks: the part's
// box at rest, in percentages of the plate, and for a part that comes to rest
// away from where it was cut, that offset as a `translate` of its own size.

export type EtchedPart = { box: number[]; from?: number[] };

/** How far a travelling part falls to its rest, in % of the plate's height (0 if it doesn't travel). */
export function partLift(part: EtchedPart) {
  return part.from ? (-part.from[1]! / 100) * part.box[3]! : 0;
}

/**
 * Custom properties placing a part on its plate (`--x`, `--y`, `--w`, `--h`),
 * its masks for small and large screens, and, for a part that travels, where
 * it starts (`--from-x`, `--from-y`) and the plate height it falls (`--lift`).
 */
export function partStyle(part: EtchedPart, masks: { small: string; large: string }) {
  const [x, y, w, h] = part.box as [number, number, number, number];
  const style = [
    `--x: ${x}%`,
    `--y: ${y}%`,
    `--w: ${w}%`,
    `--h: ${h}%`,
    `--mask-small: url(${masks.small})`,
    `--mask-large: url(${masks.large})`
  ];
  if (part.from) {
    const [fromX, fromY] = part.from as [number, number];
    style.push(`--from-x: ${fromX}%`, `--from-y: ${fromY}%`, `--lift: ${partLift(part)}%`);
  }
  return style.join("; ");
}

/** A part's two masks out of an `import.meta.glob` of `<plate>-<part>-{1200,2400}.webp`. */
export function partMasks(urls: Record<string, string>, plate: string, part: string) {
  const find = (width: number) => {
    const url = Object.entries(urls).find(([path]) =>
      path.endsWith(`/${plate}-${part}-${width}.webp`)
    )?.[1];
    if (!url) throw new Error(`No ${width}px mask for ${plate} ${part}`);
    return url;
  };
  return { small: find(1200), large: find(2400) };
}
