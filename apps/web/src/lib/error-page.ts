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
      body: "Your account doesn't have access to this page. Ask an administrator for access.",
      scene: ERROR_SCENES.gate,
      canRetry: false
    };
  }

  const canRetry = status >= 500;
  return {
    title: "Unable to load this page",
    // The 5xx body names the "Try again" button beside it; other statuses have none.
    body: canRetry
      ? "Try again, or come back in a few minutes."
      : "Check the link you followed, or come back in a few minutes.",
    scene: ERROR_SCENES.crates,
    canRetry
  };
}

export const SUPPORT_EMAIL = "support@vmblogistics.id";

/**
 * The query of a `mailto:` link to the support team for an unexpected failure:
 * the reference in the subject, and the reference, page and time in the body, so
 * support can find the log line without asking. `occurredAt` is the server's
 * ISO time, shown in UTC so the server and the browser render the same link.
 */
export function supportMailtoQuery({
  errorId,
  path,
  occurredAt
}: {
  errorId: string;
  path: string;
  occurredAt?: string;
}): string {
  const time = occurredAt ? `${occurredAt.slice(0, 10)} ${occurredAt.slice(11, 16)} UTC` : "";
  const body = [
    `Reference: ${errorId}`,
    `Page: ${path}`,
    ...(time ? [`Time: ${time}`] : []),
    "",
    "What were you doing when this happened?",
    ""
  ].join("\r\n");
  const subject = `VMB error ${errorId}`;
  return `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
