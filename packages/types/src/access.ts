import { z } from "zod";

/**
 * What the signed-in user may do and where they belong: the permission keys
 * their active roles grant (`master-users.view_any`) and the divisions those
 * roles are scoped to. It is the one thing every screen needs about the caller,
 * so it has its own endpoint instead of borrowing the Users resource, which
 * only someone with `master-users.view` may read.
 */
export const AccessSchema = z.object({
  permissions: z.array(z.string()),
  divisions: z.array(z.object({ id: z.uuid(), name: z.string(), iconName: z.string() }))
});

export type Access = z.infer<typeof AccessSchema>;
