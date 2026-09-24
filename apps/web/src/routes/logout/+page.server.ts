import { withAuthApiClient } from "$lib/api-access.js";
import { redirect } from "@sveltejs/kit";
import type { Actions } from "./$types.js";

// Best effort by design: the API destroys the session and clears the cookie,
// but if it is unreachable the user still leaves the app rather than being
// trapped on a page whose only action failed. The next request's session
// check tells the truth — a surviving cookie simply signs them back in.
export const actions: Actions = {
  default: async (event) => {
    const access = await withAuthApiClient(event, (client) => client.signOut());

    if (!access.ok) {
      console.error("logout action: request to API failed", access.error);
    }

    redirect(303, "/login");
  }
};
