# ADR-0034: Database-backed sessions, gated at creation and bridged to apps/web

**Context:** #7 had to document the session/token strategy, extending ADR-0012 (Better Auth) and ADR-0018 (required verification without auto-sign-in). The pieces around it were decided separately: the durable business record and identity ownership (ADR-0032), activation for migrated accounts (ADR-0033), and the removal of public sign-up. What remained was the session itself: where it lives, how long it lasts, how a browser on apps/web receives a cookie set by apps/api, and where the "may this person be signed in at all" check sits.

**Options considered:**

- **Stateless tokens (JWT) or Better Auth's `session.cookieCache`.** Fewer database reads, but revocation becomes eventual: a soft-deleted user's existing cookie keeps working until expiry. Rejected — offboarding is the one case the gate exists for.
- **A shared cookie domain (`advanced.crossSubDomainCookies`).** Impossible here: apps/web (Pages) and apps/api (Workers) are different registrable domains, not subdomains of one.
- **Link-based activation and magic-link sign-in.** Rejected in ADR-0033: the emailed link lands on the API origin, where the session cookie never reaches apps/web — the reason ADR-0018 forbids auto-sign-in after verification. OTP codes typed into the web UI cross the existing bridge instead.
- **Database-backed sessions with the `sveltekitCookies` bridge, gated at creation.** Chosen.

**Decision:**

- A session is a row in `public.session`, created by Better Auth. Lifetimes are Better Auth's defaults, deliberately not overridden: a 7-day absolute expiry, refreshed after 24 hours of use; no cookie cache, so the database is the source of truth and revocation takes effect on the next request. Soft-deleting a user revokes all of their sessions in the same store operation.
- The cookie is httpOnly, `SameSite=Lax`, `Secure`, set on the API's response and forwarded onto apps/web's own response by `sveltekitCookies` (server-side form actions and hooks call the API directly, so the browser never needs to see the API's `Set-Cookie`).
- Every session is created through one gate: `databaseHooks.session.create.before` (`apps/api/src/sign-in-gate.ts`) rejects a user whose `master.users` row is missing or soft-deleted with `403 ACCOUNT_UNAVAILABLE`, covering every session-creating path — password sign-in, OTP activation, and anything added later. Resource-level authorization is #8's, deliberately not here.
- Web routes gate in one place: the root layout server guard with a public allowlist (`/login`, `/activate`, `/logout`); a new page is protected unless someone deliberately names it public. API routes gate with `requireSession` on `/api/master/*`; `/health` and `/api/auth/*` stay open by construction.
- Credentials are Better Auth's default scrypt in `public.account`. Migrated accounts carry none and activate by email OTP (ADR-0033); admin-created users (Master CRUD) get one and verify their email via ADR-0018's link before password sign-in is allowed.
- Sign-up is disabled on both `emailAndPassword` and the OTP plugin; users are provisioned by admins, as in the legacy app.
- Logout is best-effort: the API destroys the session and clears the cookie, and apps/web redirects to `/login` even if the API is unreachable rather than trapping the user on a failed action.

**Trade-offs:** Every authenticated request pays a session lookup (and session refresh at most once a day), where a signed token would pay none — accepted for immediate revocation, and the lookup is one indexed row beside the query the request was going to make. The gate reads the business record on session creation only, not per request, so a record soft-deleted mid-session stays usable until the store's revocation lands or the session expires; that window is one request with no cache in front of it. The public allowlist means a new public route is a deliberate edit to one set rather than a layout placement, which is the point: forgetting is safe in the other direction.
