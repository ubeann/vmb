# ADR-0027: Database session timezone declared UTC

**Amended by [ADR-0029](0029-app-on-every-branch.md):** the application database is `app` on every environment branch now, `neondb` is removed, and local development's `DATABASE_URL` is a per-developer branch rather than the production branch's `neondb` — so the body's `vmb`, `neondb` and local-development sentences describe the state before that change. The declaration itself and the reasoning below stand unchanged.

**Context:** Every stored timestamp is already an absolute instant: `0022` converted the schema to `timestamptz(3)`, and Better Auth's columns were written through a driver that serialises a `Date` as UTC. Storage is unambiguous. Rendering is not. `timestamptz` is rendered as text in the session's `TimeZone`, and until now that zone was inherited rather than declared — Neon's compute defaulted to `GMT`, the drivers default their own sessions to UTC, and nothing said so. The same row can therefore read as `2026-01-02 01:00` in one session and `2026-01-02 08:00` in another (measured: session `UTC` versus session `Asia/Jakarta` on a row holding `2026-01-02T01:00:00Z`), and the difference reads as a bug in the data. Issue #115 is the other half of the contract: the application renders in the _reader's_ zone, from their profile, never the server's. This ADR only fixes the default for sessions no application code has configured.

**Options considered:**

- **Leave the inherited default.** Rendering depends on whichever zone the compute or the driver happened to start with; nothing declares it, and a change to either would silently change every unqualified render.
- **Set the zone per session in application code or the connection string** (`options=-c TimeZone=UTC`). Correct but not declarative: it must be repeated on every path (Worker driver, migration CLI, seeder, importer, a human's `psql`) and a missed path is invisible.
- **A Drizzle migration.** Rejected. Per-database configuration is not schema; the chain runs against whichever database it is pointed at, including ephemeral preview branches, where the statement is redundant — and cutover replays the chain (ADR-0024), so it would be noise there regardless.
- **A declared per-database setting** — `ALTER DATABASE <db> SET timezone TO 'UTC'` on each environment's application database. Chosen.

**Decision:** The application database (`vmb`) declares `timezone = 'UTC'` on the production branch. There is no dev branch to mirror it: the Neon project today holds `production` and per-PR preview branches only, even though ADR-0019 and ADR-0024 refer to a standing dev branch — this ADR records the state found (issue #133) rather than overriding them silently, and if that branch is ever provisioned the same statement belongs on its `vmb`. Staging is unprovisioned too: ADR-0015's standing environment was superseded as the dry-run mechanism by ADR-0019, and the `apps/api` staging target still waits on an explicit decision (ARCHITECTURE.md §11) — the same statement applies if it is ever provisioned. The branch's default `neondb` database is not the application database and is left as it is. Preview branches are forked from `production` (ADR-0019), so new ones inherit the declaration with no statement in `preview.yml`; a preview branch created before this decision keeps the old default until it is recreated, which is harmless — the app renders in the reader's zone and never in the session's. Local development reaches the database through the fnox `DATABASE_URL`, which currently resolves to the production branch's `neondb` database; that is a local-tooling connection string, not a dev environment, and this ADR does not change it.

**Trade-offs:** One statement per database, visible in `pg_db_role_setting`, inherited by every new session and every new Neon branch, so `psql`, an ad-hoc `to_char` report, the migration tooling, and production all agree without anyone remembering to set anything. A session that wants another zone must now say so explicitly (`SET timezone` / `PGTZ`) — which is the point: the local-time rendering has to be a chosen, visible act. Two costs are accepted: the declaration lives outside version control (it is configuration, so this ADR is its record — do not "fix" it to local time, and do not add it to the migration chain), and the pooler reuses server connections, so a backend established before the change keeps rendering its connect-time zone until it recycles; a fresh direct connection, or a restarted compute, sees `UTC`. It does not touch `0022`'s `AT TIME ZONE 'Asia/Jakarta'`: that statement _interprets_ a naive legacy wall-clock value and decides the instant, while this setting changes only text.

**Consequences:**

- Apply on each environment's application database (`app`; `vmb` before ADR-0029):
  `ALTER DATABASE app SET timezone TO 'UTC';`
  On production this was applied and verified on 2026-09-22 (issue #133), and a fresh fork of `production` reads it from a new session, so previews inherit it.
- Verify in a fresh session: the direct endpoint, or a pooled one — a pooled backend that predates the change keeps its connect-time zone until the compute's autosuspend recycles it.

  ```sql
  SELECT current_setting('TimeZone');  -- UTC
  SELECT to_char('2026-01-02T01:00:00Z'::timestamptz, 'YYYY-MM-DD HH24:MI');  -- 2026-01-02 01:00
  ```

  The declaration itself is visible as a `pg_db_role_setting` row (`setconfig = {TimeZone=UTC}`) on that database.

- No application change: reads and writes are unaffected, and rendering in the reader's zone is #115.
