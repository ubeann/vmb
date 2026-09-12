# Legacy reference: vmb-warehouse

VMB is being rebuilt from an existing Laravel + Filament app. That app is the source of truth for current business logic, data shape, and permission rules until each module reaches parity — consult it, don't just infer behaviour from ARCHITECTURE.md.

## Where it lives

- **Canonical: `github.com/ubeann/vmb-warehouse`** — use this, not a local path. A local clone's path is machine-specific and will break for other developers, other agents, and CI.
- Default/active development branch: `development` (also `origin/HEAD`).
- `production` branch reflects what's actually deployed — treat it as the parity baseline when verifying a module before cutover (see ARCHITECTURE.md §10).

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
