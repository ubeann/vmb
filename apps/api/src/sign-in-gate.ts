import type { SignInEligibility } from "@vmb/db";
import { APIError } from "better-auth/api";

/**
 * The lookup the gate reads. `master.users` is the durable record (ADR-0032)
 * and `deletedAt` its soft-delete marker; there is deliberately no status
 * check — legacy never enforced `users.status`, and the unmerged
 * `refactor/divisions-on-roles` branch removes the column (deviations ledger).
 */
export type BusinessUserLookup = (userId: string) => Promise<SignInEligibility>;

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
