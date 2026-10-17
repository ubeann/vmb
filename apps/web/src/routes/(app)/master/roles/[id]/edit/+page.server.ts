import { withApiClient } from "$lib/api-access.js";
import { getRole, updateRole, pageErrorStatus } from "$lib/master/api.js";
import { RoleFormUpdateSchema, roleFormData } from "$lib/master/form-data.js";
import { createMasterFormAction } from "$lib/master/form-action.js";
import { requirePermission } from "$lib/master/permissions.js";
import { error } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  await requirePermission(event, "master-roles.update");
  const access = await withApiClient(event, (client) => getRole(client, event.params.id));

  if (!access.ok) {
    console.error("role edit: failed to reach the API", access.error);
    error(500, "Could not load this role. Please try again.");
  }
  if (!access.value.ok) {
    error(pageErrorStatus(access.value.status), access.value.error);
  }
  const role = access.value.value;
  // nobody can edit a System Role: the API answers an edit of it 403, and so does this
  if (role.isSystem) error(403, "System roles cannot be modified or deleted.");
  // nor one that grants what the caller lacks (ADR-0045's amendment of 2026-10-17)
  const { permissions } = await event.parent();
  if (!role.permissionKeys.every((key) => permissions.includes(key))) {
    error(403, "You cannot change a role that carries permissions you do not have.");
  }

  return {
    role,
    crumb: { label: role.name, tile: { iconName: role.iconName, colorHex: role.colorHex } },
    form: await superValidate(roleFormData(role), zod4(RoleFormUpdateSchema))
  };
};

export const actions: Actions = {
  default: createMasterFormAction({
    schema: RoleFormUpdateSchema,
    logLabel: "role update",
    submit: (client, data, event) => updateRole(client, event.params.id ?? "", data),
    redirectTo: (role) => `/master/roles/${role.id}`
  })
};
