import { withApiClient } from "$lib/api-access.js";
import { getDivision, getUser, type ApiResult } from "$lib/master/api.js";
import { SIDEBAR_COOKIE_NAME } from "$lib/components/ui/sidebar/constants.js";
import type { Division } from "@vmb/types";
import type { LayoutServerLoad } from "./$types.js";

// What the shell shows of the user's division: the session knows who they are,
// but the division lives on the business record (ADR-0032). A failed lookup
// leaves the sidebar without it rather than taking every screen down.
export const load: LayoutServerLoad = async (event) => {
  const user = event.locals.user;
  // The sidebar writes its own cookie when toggled; reading it here renders the
  // collapse state the user left, with no flash on a reload.
  const sidebarOpen = event.cookies.get(SIDEBAR_COOKIE_NAME) !== "false";
  if (!user) return { division: null, sidebarOpen };

  const access = await withApiClient(event, async (client): Promise<ApiResult<Division | null>> => {
    const record = await getUser(client, user.id);
    if (!record.ok) return record;
    if (!record.value.divisionId) return { ok: true, value: null };
    return getDivision(client, record.value.divisionId);
  });

  if (!access.ok) {
    console.error("app layout load: failed to reach the API", access.error);
    return { division: null, sidebarOpen };
  }
  if (!access.value.ok) {
    console.error("app layout load: API refused the division lookup", access.value.error);
    return { division: null, sidebarOpen };
  }

  const division = access.value.value;
  return {
    division: division ? { name: division.name, iconName: division.iconName } : null,
    sidebarOpen
  };
};
