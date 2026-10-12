# ADR-0055: Soft delete stays a timestamp; deleted records are read-only

**Context:** A deleted division or user stays in its table with `deleted_at` set (the Trash, GLOSSARY.md). Nothing said what may still write to such a row. Divisions refused to be switched on or off while Trashed, but a save to a Trashed division or user went through, and a stale form submitted after a delete would have been answered as a 409 for a record the editor can no longer reach. The question was also raised whether soft delete should be a boolean (`is_deleted`) with `updated_at` as the deletion date, since a boolean reads more plainly in a query.

**Options considered:**

- **A boolean plus `updated_at`.** Reads well, but any later write to a deleted row would silently move its deletion date, and every table would need a migration. `deleted_at` is already the convention in master, expense and trucking, and the partial unique indexes (`where deleted_at is null`) that let a Trashed division free its name and code are written against it.
- **A boolean beside `deleted_at`.** Two columns that can disagree, for no gain.
- **Keep `deleted_at` and make a Trashed record read-only.** Chosen.

**Decision:** Soft delete stays the `deleted_at` timestamp, and a deleted record is read-only until it is restored. Restore is the only write a Trashed record accepts.

- Every write to a soft-deletable record (today divisions and users) carries `deleted_at is null` in its own `where`, so the write itself decides it and nothing read beforehand can let a delete slip past: a delete racing an edit settles inside the database: whichever statement runs first wins, and an edit that loses changes nothing. Delete and Restore carry the opposite test (`is null`, `is not null`), so each can run once.
- A write that finds no live row answers 404, as the division switch already did, and not 409: a Trashed record is out of reach, and reloading the form would not help. A live record that changed since the form loaded stays a 409 `STALE_RECORD` (#374). The check for a Trashed record comes first, so a form submitted after a delete is a 404. A check ahead of the write, such as who may manage a user, can still answer first with its own refusal.
- Delete and Restore move `updated_at` past the stamp they replace, as a save does (`nextStamp`), so a form opened before a delete and restore is stale afterwards and cannot overwrite what the record became.
- The deletion date `deleted_at` is written only by Delete and cleared only by Restore, so it never moves while the record is Trashed.
- Activation and password reset write to the Better Auth identity (`public.account`, `public.verification`), not to the business record, and are write paths too. A Trashed user is an unknown email to every code path (#405): requesting a code sends no email and stores an unsent decoy, and a code issued before the delete is swapped for a decoy before Better Auth checks or spends it, so check, reset, email verification and OTP sign-in all fail as an unknown email's do and no credential is written. Restoring the user lets them request a fresh code as usual.
- The pages follow the API. A Trashed record's page shows it with Restore as its only action, and its edit route is a 404 instead of a form. The Trash's row menus offer Restore only, since the Trash has no permanent delete.
- Roles are not soft-deletable: a Role is deleted permanently (GLOSSARY.md), so this rule does not reach them.

**Trade-offs:** A query that wants "live rows" writes `deleted_at is null` rather than a boolean, and a future table must put the same test in every write it adds; the API test that drives each write path against a Trashed record is where a missed one shows. Reading a Trashed record's `updated_at` as "when it was last changed" still holds, since a refused write leaves it alone. No migration is needed, and the existing indexes and the Trash views keep working.
