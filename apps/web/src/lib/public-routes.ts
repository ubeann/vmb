// Routes reachable without a session (#7). The web gate is the request-level
// check in `hooks.server.ts`: everything not named here is protected by
// default, so a new page cannot accidentally ship unauthenticated.
export const PUBLIC_ROUTES = new Set(["/login", "/activate", "/logout"]);

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}
