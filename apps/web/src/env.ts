import { defineEnvVars } from "@sveltejs/kit/env";

// An unset or empty value reads as undefined.
const optional = (value: string | undefined) => value || undefined;

// The Pages bindings the server reads through `$app/env/private`. adapter 8
// hands SvelteKit the Worker's `env` from `cloudflare:workers`, and `vite dev`
// emulates it from wrangler.toml and `.dev.vars`. Both are optional here:
// resolveApiUrl decides what a missing API_URL means, and a missing secret
// sends no client-IP proof.
export const variables = defineEnvVars({
  API_URL: {
    description: "The deployed vmb-api Worker's URL, set per environment in the Pages dashboard.",
    schema: optional
  },
  CLIENT_IP_SECRET: {
    description:
      "Shared with vmb-api; sent with the browser's address so vmb-api can trust it as the client IP (ADR-0042).",
    schema: optional
  }
});
