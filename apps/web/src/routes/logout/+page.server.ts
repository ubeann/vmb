import { withAuthApiClient } from "$lib/api-access.js";
import { redirect } from "@sveltejs/kit";
import type { Actions } from "./$types.js";

// Best effort by design: the API destroys the session and clears the cookie,
// but if it is unreachable or refuses, the user still leaves the app rather
// than being trapped on a page whose only action failed. The next request's
// session check tells the truth — a surviving cookie simply signs them back in.
// The access seam forwards the browser's cookie, which is how the API finds the
// session row to delete (#226).
export const actions: Actions = {
  default: async (event) => {
    const access = await withAuthApiClient(event, (client) => client.signOut());

    if (!access.ok) {
      console.error("logout action: request to API failed", access.error);
    } else if (access.value.error) {
      console.error("logout action: API refused sign-out", access.value.error);
    }

    redirect(303, "/login?logged_out=true");
  }
};
