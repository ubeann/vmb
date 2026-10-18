// See https://svelte.dev/docs/kit/types#app.d.ts
import type { AuthSession, AuthUser } from "$lib/auth.js";
import type { RecordCrumb } from "$lib/breadcrumbs.js";
import type { LayerEntry } from "$lib/components/list/layer/layer-route.svelte.js";

declare global {
  // Injected at build time by CI (issue #23) so each per-PR web preview can
  // point at its own `apps/api` Worker Preview. Exposed to the bundle by
  // Vite's `envPrefix` (see vite.config.ts). Unset for local dev/production,
  // where resolveApiUrl falls back to the API_URL binding / localhost.
  interface ImportMetaEnv {
    readonly PUBLIC_API_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  namespace App {
    // `errorId` and `occurredAt` (ISO) are set by `handleError` for unexpected
    // failures (hooks.server.ts). Kit 3 adds `status` to every App.Error.
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
    // A record opened in a layer over its list (#302): its page's URL and data.
    interface PageState {
      layer?: LayerEntry;
    }
  }
}

export {};
