import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types.js";

// The web half of #7's gate. A route is public only if it is named here, so
// everything else is protected by default and a new page cannot accidentally
// ship unauthenticated. Whether the session's business record still exists is
// enforced where the session is created (`apps/api/src/sign-in-gate.ts`).
const PUBLIC_ROUTES = new Set(["/login", "/activate", "/logout"]);

export const load: LayoutServerLoad = ({ locals, url }) => {
  if (!locals.user && !PUBLIC_ROUTES.has(url.pathname)) {
    redirect(303, "/login");
  }

  return { user: locals.user };
};
