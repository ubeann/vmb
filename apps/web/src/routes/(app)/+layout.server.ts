import { withApiClient } from "$lib/api-access.js";
import { getMyAccess } from "$lib/master/api.js";
import { SIDEBAR_COOKIE_NAME } from "$lib/components/ui/sidebar/constants.js";
import type { LayoutServerLoad } from "./$types.js";

// What the shell knows of the signed-in user beyond the session: their
// permissions (`master-users.create`, for screens to hide what the API would
// refuse) and the division they belong to. Both come from the caller's own
// access endpoint, open to every signed-in user, so a user who may not read
// Divisions or Users still gets a shell. A failed lookup leaves the sidebar
// without a division and the page without permissions, rather than taking
// every screen down.
export const load: LayoutServerLoad = async (event) => {
  const user = event.locals.user;
  // The sidebar writes its own cookie when toggled; reading it here renders the
  // collapse state the user left, with no flash on a reload. A cookie means the user
  // chose; with none, a tablet starts on the icon rail (ADR-0050).
  const sidebarCookie = event.cookies.get(SIDEBAR_COOKIE_NAME);
  const sidebarOpen = sidebarCookie !== "false";
  const sidebarSaved = sidebarCookie !== undefined;
  if (!user) return { division: null, permissions: [], sidebarOpen, sidebarSaved };

  const access = await withApiClient(event, (client) => getMyAccess(client));

  if (!access.ok) {
    console.error("app layout load: failed to reach the API", access.error);
    return { division: null, permissions: [], sidebarOpen, sidebarSaved };
  }
  if (!access.value.ok) {
    console.error("app layout load: API refused the access lookup", access.value.error);
    return { division: null, permissions: [], sidebarOpen, sidebarSaved };
  }

  const [division] = access.value.value.divisions;
  return {
    division: division ? { name: division.name, iconName: division.iconName } : null,
    permissions: access.value.value.permissions,
    sidebarOpen,
    sidebarSaved
  };
};
