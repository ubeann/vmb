// See https://svelte.dev/docs/kit/types#app.d.ts
import type { AuthSession, AuthUser } from "$lib/auth.js";

declare global {
  // Injected at build time by CI (issue #23) so each per-PR web preview can
  // point at its own `apps/api` preview version. Exposed to the bundle by
  // Vite's `envPrefix` (see vite.config.ts). Unset for local dev/production,
  // where resolveApiUrl falls back to the Pages binding / localhost.
  interface ImportMetaEnv {
    readonly PUBLIC_API_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  namespace App {
    interface Locals {
      session: AuthSession | null;
      user: AuthUser | null;
    }
    interface Platform {
      env: {
        API_URL: string;
      };
    }
  }
}

export {};
