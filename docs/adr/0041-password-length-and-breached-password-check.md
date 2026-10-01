# ADR-0041: Passwords — length and a breached-password check, no composition rules

**Context:** A password is set in two places, with two rules. `/activate` (Activation and Password reset) allows 8–128 characters, Better Auth's `minPasswordLength`/`maxPasswordLength` defaults (`packages/types/src/auth.ts`). The Master CRUD user form allows 8–255 (`packages/types/src/users.ts`) and hashes the password itself, so Better Auth never checks it. The owner asked for stronger passwords: uppercase, symbols and 8–25 characters were the starting idea. A password is the only thing needed to sign in; there is no second factor.

**Options considered:**

- Composition rules (an uppercase letter, a digit, a symbol) and an 8–25 character range: the familiar pattern, but NIST SP 800-63B rev. 4 says verifiers shall not impose composition rules. They push people towards predictable forms such as `Password1!`. A 25-character cap blocks passphrases, and NIST asks that at least 64 be allowed.
- Length only, at NIST's single-factor minimum of 15: the strongest reading, but a large jump from 8 for warehouse and trucking staff.
- Length 12–128, plus a check against known-breached passwords: a real step up from 8, no rules that teach bad habits, and it rejects the passwords attackers try first.
- Better Auth's `haveibeenpwned` plugin for the breached check: it fails closed (an unreachable Pwned Passwords API is a 500, read from its 1.7.5 source). It also covers only Better Auth's own endpoints, so the Master CRUD form would still bypass it.

**Decision:** One password rule, in `packages/types`, used by `/activate` and the Master CRUD user form alike: **12 to 128 characters, with no composition rules**. Better Auth's `minPasswordLength`/`maxPasswordLength` are set to the same bounds, so the server enforces them too. A new password is also checked against Pwned Passwords. The check uses the k-anonymity range API, so only the first 5 hex characters of the password's SHA-1 leave the server. VMB's own check runs on both paths and **fails open**: when the API cannot be reached, the password is accepted and the failure is logged. The form shows the rule while the user types ("At least 12 characters"), with a passphrase hint. A breached password is refused after submit, with its own copy. Passwords already set are not touched; the rule applies when a password is set.

**Trade-offs:** Fail-open means an outage at a third party can let a breached password through, accepted so that activation never depends on that service being up. VMB owns a small HTTP check instead of a plugin, in exchange for one rule on both paths and the failure mode chosen here. Moving to NIST's 15 characters is left for when a second factor exists, or for a later decision.
