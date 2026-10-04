import post from "./assets/activate/vmb-activate-post-640.webp";
import seal from "./assets/activate/vmb-activate-seal-192.webp";

/**
 * The etched art on /activate's code step (#273): each an ink mask and its
 * width ÷ height. `activate-art.test.ts` fails when a ratio no longer matches
 * its file.
 */
export const ACTIVATE_ART = {
  /** A sealed envelope tucked into the card's top-right corner. */
  seal: { image: seal, ratio: 1.254, file: "vmb-activate-seal-192.webp" },
  /** Sealed letters on a crate beside a service bell, left of the card. */
  post: { image: post, ratio: 1.937, file: "vmb-activate-post-640.webp" }
} as const;
