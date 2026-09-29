import crates from "./assets/errors/vmb-error-crates.webp";
import gate from "./assets/errors/vmb-error-gate.webp";
import road from "./assets/errors/vmb-error-road.webp";

/** An engraved vignette: an ink mask and its width ÷ height. */
export interface ErrorScene {
  name: "road" | "gate" | "crates";
  image: string;
  ratio: number;
}

export interface ErrorPageContent {
  title: string;
  body: string;
  scene: ErrorScene;
  /** Server-side failures may pass on a reload, so the page offers one. */
  canRetry: boolean;
}

// Ratios match the shipped masks (error-page.test.ts checks them). The scene
// follows the status, never chance, so the server and the browser draw the
// same picture and a refresh doesn't swap it.
export const ERROR_SCENES = {
  road: { name: "road", image: road, ratio: 1.261 },
  gate: { name: "gate", image: gate, ratio: 2.111 },
  crates: { name: "crates", image: crates, ratio: 0.876 }
} as const satisfies Record<ErrorScene["name"], ErrorScene>;

/**
 * Fixed, status-specific copy for `+error.svelte`: never `page.error.message`,
 * which is server or library text not meant for a visitor (#205).
 */
export function errorPageContent(status: number): ErrorPageContent {
  if (status === 404 || status === 410) {
    return {
      title: "Page not found",
      body: "This page doesn't exist or has moved.",
      scene: ERROR_SCENES.road,
      canRetry: false
    };
  }

  if (status === 401 || status === 403) {
    return {
      title: "No access to this page",
      body: "Your account can't open this page. Ask an administrator if you need access.",
      scene: ERROR_SCENES.gate,
      canRetry: false
    };
  }

  return {
    title: "Something went wrong",
    body: "Try refreshing the page, or come back in a few minutes.",
    scene: ERROR_SCENES.crates,
    canRetry: status >= 500
  };
}
