// `import type { AppType } from "@vmb/api"` type-checks apps/api's source here,
// and that source imports `cloudflare:workers`, which only @cloudflare/workers-
// types declares. Loading those types in this browser-and-node project would
// clash with the DOM's, so this declares just what the API imports from it.
declare module "cloudflare:workers" {
  export function waitUntil(promise: Promise<unknown>): void;
}
