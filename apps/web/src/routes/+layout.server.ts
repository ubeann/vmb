import type { LayoutServerLoad } from "./$types.js";

// Session data for the shell. Request-level rejection happens in
// `hooks.server.ts` before routing (one seam, honouring the public allowlist in
// `$lib/public-routes.js`), so this load only hands the layout what it renders.
export const load: LayoutServerLoad = ({ locals }) => {
  return { user: locals.user };
};
