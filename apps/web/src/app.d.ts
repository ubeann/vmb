// See https://svelte.dev/docs/kit/types#app.d.ts
import type { AuthSession, AuthUser } from "$lib/auth.js";
import type { RecordCrumb } from "$lib/breadcrumbs.js";

declare global {
  // Injected at build time by CI (issue #23) so each per-PR web preview can
  // point at its own `apps/api` Worker Preview. Exposed to the bundle by
  // Vite's `envPrefix` (see vite.config.ts). Unset for local dev/production,
  // where resolveApiUrl falls back to the Pages binding / localhost.
  interface ImportMetaEnv {
    readonly PUBLIC_API_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  namespace App {
    // `errorId` and `occurredAt` (ISO) are set by `handleError` for unexpected
    // failures (hooks.server.ts).
    interface Error {
      message: string;
      errorId?: string;
      occurredAt?: string;
    }
    interface Locals {
      session: AuthSession | null;
      user: AuthUser | null;
    }
    // The root layout load always returns `user`, so this is the one property
    // every route's `data` is guaranteed to carry — including `+error.svelte`,
    // which has no `data` prop of its own and reads `page.data` instead.
    interface PageData {
      user: AuthUser | null;
      // A record's page names the record for the top bar's trail (#349).
      crumb?: RecordCrumb;
    }
    interface Platform {
      env: {
        API_URL: string;
        // Shared with apps/api; sent with the browser's address so apps/api
        // can trust it as the client IP (ADR-0042). Unset, neither is sent.
        CLIENT_IP_SECRET?: string;
      };
    }
  }
}

export {};
