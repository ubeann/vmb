import { PREVIEW_USER_PASSWORD, PREVIEW_USER_PASSWORD_HASH } from "@vmb/db/seed";
import { verifyPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";

/**
 * `db:seed` (issue #120) commits a credential for the preview login, and this
 * is the half of that contract `packages/db` cannot check for itself: the
 * digest must be one `apps/api`'s Better Auth accepts. `verifyPassword` is the
 * verifier `signInEmail` calls — `auth.ts` does not override
 * `emailAndPassword.password.verify` — so a pass here is the check a preview
 * sign-in runs.
 */
describe("preview login", () => {
  it("accepts the password the preview seeder commits", async () => {
    await expect(
      verifyPassword({ hash: PREVIEW_USER_PASSWORD_HASH, password: PREVIEW_USER_PASSWORD })
    ).resolves.toBe(true);
  });

  it("rejects a different password", async () => {
    await expect(
      verifyPassword({
        hash: PREVIEW_USER_PASSWORD_HASH,
        password: `${PREVIEW_USER_PASSWORD}-wrong`
      })
    ).resolves.toBe(false);
  });
});
