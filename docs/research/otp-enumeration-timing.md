# OTP reply and timing parity (#271)

Measured 2026-10-04 using Better Auth **1.7.7**, baseline `fab2630` and the implementation in this branch.

## Decision

Keep a verification row for unknown emails, with a random 32-character alphanumeric secret that is never sent. Registered emails still receive a six-digit code. Hash both with the SHA-256/base64url representation used by Better Auth's `storeOTP: "hashed"`, giving every failed comparison the same input length and hash work. Better Auth retains ownership of checking, attempt counting, expiry, and atomic consumption during reset.

Replace only public issuance handlers, preserving their endpoint options (including CSRF middleware), and retain the plugin's rate-limit rules. Cover the main password-reset request, its deprecated alias, and generic OTP sending. The latter otherwise provides a bypass simply by asking for `type: "forget-password"`; its other public types now retain decoys too. Do not send email or create a User, Identity, credential or session for an unknown address.

This avoids rewriting errors and adding an arbitrary response-time floor. The measured difference comes from unequal database operations, which a fixed delay would only hide under some network conditions. Retaining decoys gives real users the existing expiry and attempt-limit messages.

## Method

`apps/api/test/otp-timing.test.ts` is an opt-in experiment, skipped by ordinary tests. It runs the application's real Better Auth handler, Drizzle adapter and Neon HTTP driver; email delivery is stubbed. A unique synthetic registered identity and a unique absent email are used, with cleanup in `finally`. Each sample starts with a fresh code request. Check/reset measurements submit an incorrect code, never change a password, and assert `400 INVALID_OTP`. Database-backed rate limiting stays enabled; each call has a separate benchmark IP to avoid measuring a 429 response.

For each endpoint and email kind: two warm-up samples discarded, twelve samples retained, alternating registered/unknown order. The clock covers the in-process HTTP handler and response-body consumption, including real Neon round trips. These are local Node measurements, **not deployed Cloudflare Worker end-to-end timings**, and twelve samples do not establish constant-time execution under every load.

The experiment ran on temporary Neon branch `dev-issue-271-timing`, created **schema-only**, with no production rows copied. Its source auth schema predates migrations 0022 and 0027; the public auth timestamp statements from 0022 and the rate-limit table from 0027 were applied only to the empty experiment branch before collecting these results. The branch had a 24-hour expiry as a cleanup backstop and was deleted after both runs; its local connection string was removed as well.

To repeat, provide a disposable Neon branch with the current auth schema:

```sh
OTP_TIMING_DATABASE_URL='<disposable branch connection string>' \
OTP_TIMING_OUTPUT=/tmp/otp-timing.json \
pnpm --filter @vmb/api test test/otp-timing.test.ts
```

Do not use a production connection string: the experiment inserts a synthetic identity and invokes the auth handler's ordinary verification cleanup.

## Results

Milliseconds, rounded; each pair is **registered / unknown**.

| Endpoint                 | Before p50 | After p50 | Before min–max    | After min–max     |
| ------------------------ | ---------- | --------- | ----------------- | ----------------- |
| `request-password-reset` | 97 / 151   | 130 / 133 | 86–105 / 142–164  | 123–280 / 121–148 |
| `check-verification-otp` | 149 / 122  | 166 / 165 | 132–166 / 109–127 | 159–179 / 159–168 |
| `reset-password`         | 216 / 145  | 243 / 245 | 196–238 / 135–158 | 224–263 / 218–273 |

The before distributions are separated in this run; the after distributions overlap and medians differ by 1–3 ms. This supports removing the asymmetric database path rather than padding replies. It is not a statistical proof of zero timing leakage. Successful redemption remains different: possession of the delivered code authorizes that transition.

## Regression coverage and rollout

`activate-reply.test.ts` exercises the public API handler with the real Better Auth implementation and a memory database. It covers matching statuses/bodies through wrong attempts, exhaustion, expiry, subsequent invalidation, mixed Verify/reset attempts, resend, uppercase email normalization and alternate issuance paths. Registered activation still checks a code without spending it, redeems it once, and signs in with the new password. Existing tests retain request rate limits, unknown-address send suppression and background-send failure behavior.

On deployment, codes issued under the former plaintext storage setting need to be resent. They already expire after five minutes. No stored passwords, sessions, or schema change as part of this fix. Decoys consume storage until Better Auth's normal expired-verification cleanup runs.

## Sources

- [Better Auth email OTP documentation](https://better-auth.com/docs/plugins/email-otp): request, check, reset, expiry/attempt settings and hashed storage.
- Installed `better-auth@1.7.7`, `dist/plugins/email-otp/routes.mjs`, `otp-token.mjs` and `utils.mjs`: unknown-only deletion, error branches, hashed representation and atomic reset behavior. The installed version, rather than unversioned documentation, is the implementation reference.
- [Neon schema-only branches](https://neon.com/docs/guides/branching-schema-only): `init_source: "schema-only"` copies schema without application rows.
