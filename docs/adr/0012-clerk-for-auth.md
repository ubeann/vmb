# ADR-0012: Auth provider — Clerk

**Context:** `ARCHITECTURE.md` §8 left the auth provider open between a self-hosted solution (Lucia) and a managed one (Clerk), pending team preference. This blocks building the auth/session layer for the rest of the app.

**Options considered:**
- Lucia (self-hosted): no external dependency, no per-MAU ceiling, but the team owns session storage, password/OAuth flows, and MFA if ever needed.
- Clerk (managed, free tier): hosted UI and session management, MFA and OAuth providers out of the box, less code to write and maintain.

**Decision:** Clerk (managed, free tier).

**Trade-offs:** Adds an external dependency and a free-tier MAU ceiling to monitor — a departure from the project's general "minimize moving parts, $0 cost" bias (ADR-0009). In exchange, the small team doesn't have to build and maintain session/password/MFA flows by hand, which is a bigger ongoing cost for an internal tool with limited engineering bandwidth than the vendor dependency itself. Revisit if Clerk's free-tier limits become a real constraint for this user base.
