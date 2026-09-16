// See https://svelte.dev/docs/kit/types#app.d.ts
import type { AuthSession, AuthUser } from "$lib/auth.js";

declare global {
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
