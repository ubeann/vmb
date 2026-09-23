# ADR-0033: Migrated users activate by email OTP; legacy passwords are not carried

**Context:** Legacy `master.users.password` holds `$2y$12$` bcrypt hashes (BCRYPT_ROUNDS=12; every row in the only data we can see). Better Auth verifies scrypt and exposes `emailAndPassword.password.verify`, so a lazy migration was possible — verify bcrypt, rehash to scrypt on a user's first login. The alternative was to carry no passwords at all and have every migrated user activate once; cutover is also the moment users learn the platform has moved.

**Options considered:**

- **Lazy migration (verify bcrypt, rehash on login).** No cutover comms needed, but every migrated user's first login pays bcrypt (~300 ms CPU at cost 12 on Workers, measured in Miniflare) on top of scrypt's ~130–175 ms (ADR-0012), and legacy hashes live on through the migration window.
- **Keep bcrypt verification permanently.** No user friction, but pins a legacy hash format into production and keeps the Workers CPU cost forever.
- **Force a reset by emailed link at cutover.** Familiar click-through, but the link points at the API origin where a session cookie never reaches `apps/web` — the reason ADR-0018 forbids auto-signin-after-verification — and bulk-sent links with long TTLs are long-lived credentials sitting in inboxes.
- **Carry no credentials; activation by email OTP.** Chosen.

**Decision:** The identity transform imports each legacy account with no credential row; `master.users.password` is dropped and no bcrypt hash enters Better Auth. First access is an activation: the login page sends a one-time code (`emailOTP` plugin, `disableSignUp: true`, 5-minute expiry), and the same screen takes the code plus a new password (`emailOTP.resetPassword`, which creates the missing credential). Migrated users import as `emailVerified: true` — they are admin-provisioned and every row we can see carries `email_verified_at` — so the password sign-in that follows is not blocked by `requireEmailVerification`. Phone is not a channel: Better Auth's phone plugin ships no SMS vendor and legacy phone data is not identity-grade. The awareness job is done by an announcement email carrying no secret, sent on demand rather than bulk.

**Trade-offs:** Every migrated user needs a working inbox to get in, so cutover-day support moves from "nobody" to "anyone whose email bounces" — mitigated by the admin fallback (an admin sets a password through #6's user detail, or triggers a fresh activation) and by activating the super-admins first. In exchange no legacy hash format reaches production, the first login cannot fail on a Workers CPU budget, and the activation email doubles as the platform announcement.

**Consequences:** #7 builds and fixture-tests the transform, wires the OTP transport through `apps/api/src/email.ts` (ADR-0017; previews log instead of send, #121), and owns the sign-in gate that reads the business record. The cutover runbook (#17) activates super-admins first and records the admin fallback; the rehearsal (#18) exercises activation end to end.
