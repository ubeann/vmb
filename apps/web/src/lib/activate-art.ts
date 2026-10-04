import slip from "./assets/activate/vmb-activate-slip-256.webp";

/**
 * The etched art on /activate's code step (#273): an ink mask and its width ÷
 * height. `activate-art.test.ts` fails when a ratio no longer matches its file.
 */
export const ACTIVATE_ART = {
  /** An open envelope with a slip half out, showing a row of empty boxes. */
  slip: { image: slip, ratio: 1.129, file: "vmb-activate-slip-256.webp" }
} as const;
