import { firstMasterScreen } from "$lib/nav.js";
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types.js";

// `/master` is no screen of its own: it leads to the first list the caller may open, and
// to the dashboard, which says so, when they may open none.
export const load: PageServerLoad = async (event) => {
  const { permissions } = await event.parent();
  redirect(303, firstMasterScreen(permissions) ?? "/");
};
