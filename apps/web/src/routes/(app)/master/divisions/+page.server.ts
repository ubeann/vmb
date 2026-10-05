import { withApiClient } from "$lib/api-access.js";
import { deleteDivision, listDivisions, restoreDivision } from "$lib/master/api.js";
import { runRowAction } from "$lib/master/form-action.js";
import { parseListQuery } from "$lib/master/list.js";
import { DivisionListQuerySchema } from "@vmb/types";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  const query = parseListQuery(DivisionListQuerySchema, event.url);
  const access = await withApiClient(event, (client) => listDivisions(client, query));

  if (!access.ok) {
    console.error("divisions list: failed to reach the API", access.error);
    return { query, divisions: null };
  }
  if (!access.value.ok) {
    console.error("divisions list: API refused the request", access.value.error);
    return { query, divisions: null };
  }

  return { query, divisions: access.value.value };
};

export const actions: Actions = {
  delete: (event) =>
    runRowAction(event, {
      logLabel: "division delete",
      run: (client, id) => deleteDivision(client, id)
    }),
  restore: (event) =>
    runRowAction(event, {
      logLabel: "division restore",
      run: (client, id) => restoreDivision(client, id)
    })
};
