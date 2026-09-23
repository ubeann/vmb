import type { SqlClient } from "../sql-client.js";

export type IdentityTransformResult = {
  /** Identities created by this run; zero when everything already had one. */
  users: number;
};

/**
 * The identity half of the cutover (#7, ADR-0032/0033): every replayed
 * `master.users` row becomes a Better Auth `user`, preserving the legacy UUID —
 * the key every domain holds a foreign key to. No credential row is written:
 * migrated accounts activate by email OTP and set their own password, so the
 * snapshot's bcrypt hashes never reach Better Auth.
 *
 * Runs after the migration chain (migration `0026` has already dropped the
 * legacy auth columns), and imports every account as verified: these are
 * admin-provisioned records, and activation proves inbox control anyway.
 * Idempotent — rows that already have an identity are left alone — so a re-run
 * after a partial failure converges instead of duplicating.
 */
export async function transformIdentities(client: SqlClient): Promise<IdentityTransformResult> {
  const rows = await client.query<{ id: string }>(`
    insert into public."user" (id, name, email, email_verified, image, created_at, updated_at)
    select u.id::text, u.name, u.email, true, u.profile_photo_path,
           coalesce(u.created_at, now()), coalesce(u.updated_at, now())
      from master.users u
     where not exists (select 1 from public."user" b where b.id = u.id::text)
    returning id
  `);

  return { users: rows.length };
}
