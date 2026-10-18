import { withApiClient } from "$lib/api-access.js";
import { getMyProfile, pageErrorStatus, updateMyProfile } from "$lib/master/api.js";
import { createMasterFormAction } from "$lib/master/form-action.js";
import { profileFormData } from "$lib/master/form-data.js";
import { ProfileUpdateInputSchema } from "@vmb/types";
import { error } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types.js";

// The signed-in person's own page: any session may open it, and the API refuses
// a caller who is Trashed or not Active, so no permission check stands here.
export const load: PageServerLoad = async (event) => {
  const access = await withApiClient(event, (client) => getMyProfile(client));

  if (!access.ok) {
    console.error("profile: failed to reach the API", access.error);
    error(500, "Could not load your profile. Please try again.");
  }
  if (!access.value.ok) {
    error(pageErrorStatus(access.value.status), access.value.error);
  }

  const profile = access.value.value;
  return {
    // the email is shown, never submitted: it is an administrator's to change
    email: profile.email,
    // a save redirects back here with `?saved`, so the page says so with or without JavaScript
    saved: event.url.searchParams.has("saved"),
    // the stamp keys the form, so a save shows the saved values on a fresh, untouched form
    stamp: profile.updatedAt,
    form: await superValidate(profileFormData(profile), zod4(ProfileUpdateInputSchema))
  };
};

export const actions: Actions = {
  default: createMasterFormAction({
    schema: ProfileUpdateInputSchema,
    logLabel: "profile update",
    submit: (client, data) => updateMyProfile(client, data),
    redirectTo: () => "/profile?saved"
  })
};
