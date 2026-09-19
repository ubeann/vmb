# Legacy reference: vmb-warehouse

VMB is being rebuilt from an existing Laravel + Filament app. That app is the source of truth for current business logic, data shape, and permission rules until each module reaches parity — consult it, don't just infer behaviour from ARCHITECTURE.md.

## Where it lives

- **Canonical: `github.com/ubeann/vmb-warehouse`** — use this, not a local path. A local clone's path is machine-specific and will break for other developers, other agents, and CI.
- Default/active development branch: `development` (also `origin/HEAD`). **This is also the branch the server deploys from** — it is the code parity baseline.
- `production` branch is **unused and stale**: it sits at the 2024-08-19 `Initialize Project using Laravel 11.x` commit, ~172 commits behind `development`. Do not use it as a parity baseline.
- The deployed database (`vmb_prod`) is migrated in place — `deployment/deploy.sh` runs `artisan migrate --force`. Git cannot prove the live DB's shape, so verify cutover parity against a live `pg_dump --schema-only`, not a branch. See `docs/research/legacy-schema-inventory.md` §05 for the production↔development drift analysis.

## Structure worth knowing

Filament resources are organized by domain under `app/Filament/Resources/`:

- `Master/` — Divisions, Roles, Users
- `Trucking/` — Clients, Drivers, Trucks, Routes, Orders, Invoices
- `Warehouse/` — Items, Procurement Requests, Stock Requisitions
- `Expense/` — Budgets, Requests

Corresponding models live under `app/Models/<Domain>/`, and authorization rules under `app/Policies/Models/<Domain>/` — check these when replicating permission logic in the new RBAC layer.

## How to use it

- When a ticket says "replicate X" or "match parity with legacy", read the corresponding Filament resource/model/policy in this repo rather than guessing field names or business rules.
- If you don't have a local clone, use `gh` (`gh repo clone ubeann/vmb-warehouse` or `gh api`/`gh browse`) rather than assuming a path exists.
- Don't push changes here — it's a read-only reference during the migration.
