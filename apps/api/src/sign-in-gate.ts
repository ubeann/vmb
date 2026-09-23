import { APIError } from "better-auth/api";

/**
 * The slice of the business user the gate reads. `master.users` is the durable
 * record (ADR-0032); `deletedAt` is its soft-delete marker, and there is no
 * status check — legacy removed `users.status` and never enforced it.
 */
export type BusinessUserLookup = (
  userId: string
) => Promise<{ deletedAt: Date | string | null } | null>;

/**
 * The one seam that decides whether a session may exist at all. Wired into
 * Better Auth's `databaseHooks.session.create.before`, so it covers every path
 * that mints a session — password sign-in, OTP activation, anything added
 * later — rather than each route guarding itself. Resource-level permissions
 * are #8's job; this answers only "does this person have a place in the app".
 */
export function createSignInGate(findUser: BusinessUserLookup) {
  return async (session: { userId: string }) => {
    const user = await findUser(session.userId);

    if (!user || user.deletedAt !== null) {
      throw APIError.from("FORBIDDEN", {
        code: "ACCOUNT_UNAVAILABLE",
        message: "This account is unavailable. Contact an administrator."
      });
    }
  };
}
