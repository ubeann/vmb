import type { PermissionKey } from "@vmb/types";
import { error } from "@sveltejs/kit";

/** The API's own words when it refuses a caller (`apps/api/src/routes/master/permission.ts`). */
const FORBIDDEN = "You do not have permission to do that.";

/**
 * A page that only serves a holder of `permission`, such as a record's edit,
 * answers anyone else as the API would: 403. The shell's load has the caller's
 * permissions, so the check costs no request.
 */
export async function requirePermission(
  event: { parent: () => Promise<{ permissions: readonly string[] }> },
  permission: PermissionKey
) {
  const { permissions } = await event.parent();
  if (!permissions.includes(permission)) error(403, FORBIDDEN);
}
