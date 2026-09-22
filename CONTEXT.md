# VMB

VMB is the internal project/admin management tool being rebuilt from a Laravel + Filament application (`vmb-warehouse`). This glossary is the project's domain vocabulary; use these terms when naming things.

## Language

### Master

**Division**:
Organisational unit that groups users, warehouse items and expense budgets.
_Avoid_: Department, unit, team

**User**:
A person who signs in to VMB. Identity is owned by Better Auth (ADR-0012); business and profile attributes live alongside it.
_Avoid_: Account, member, staff

**Role**:
A named bundle of permissions granted to users.
_Avoid_: Group, access level

**Permission**:
A single capability checked during authorization.
_Avoid_: Right, privilege

### Trucking

**Client**:
The customer a trucking order is for.
_Avoid_: Customer, account, shipper

**Driver**:
A person who drives a truck.
_Avoid_: Operator, courier

**Truck**:
A company vehicle.
_Avoid_: Vehicle, unit

**Location**:
A master stop or place used to compose routes.
_Avoid_: Stop, place, point

**Route**:
A container path with size, fee and driver allowance, assembled from locations.
_Avoid_: Track, path, lane

**Client Route**:
The link declaring which routes a Client may use; a client with no links is unrestricted.
_Avoid_: Pivot, client-route assignment

**Route Location**:
The ordered join of a location into a route, carrying load type and invoice visibility.
_Avoid_: Stop, waypoint

**Order**:
The aggregate root of a trucking job for a client.
_Avoid_: Job, shipment, booking

**Trip**:
An execution of an order that snapshots the chosen route(s) and drives the daily plan/actual rows.
_Avoid_: Run, leg, shipment

**Daily Trucking Plan (DTP)**:
One planned container/unit moving on a trip.
_Avoid_: Plan, dtp (raw legacy abbreviation)

**Daily Trucking Actual (DTA)**:
One container/unit actually moved on a trip; may override the plan with changed routes.
_Avoid_: Actual, dta (raw legacy abbreviation)

**Invoice**:
A client invoice for trucking work, tracking the required documents and billed versus total amounts.
_Avoid_: Bill (a dropped legacy concept), statement

**Invoice Shipment**:
Shipping and customs detail for an invoice.
_Avoid_: Shipment detail, manifest

**Invoice Vendor**:
A vendor line item on an invoice.
_Avoid_: Vendor bill

**Client Truck Company**:
A sub-entity of a client; controls who may edit that client's DTP.
_Avoid_: Sub-client, vendor truck

### Warehouse

**Item**:
A per-division warehouse item with current stock and a reorder threshold.
_Avoid_: Product, SKU, material

**Procurement Request**:
A purchase request moving through an approval and fulfilment workflow.
_Avoid_: Purchase order, PR (raw abbreviation)

**Procurement Quotation**:
A vendor quotation plus the payment and receipt evidence for a procurement request.
_Avoid_: Quote, bid, PO

**Stock Requisition**:
An internal request to draw stock down from an item.
_Avoid_: Withdrawal, issue slip

**Stock Alert**:
A low-stock event raised when an item reaches its reorder level.
_Avoid_: Notification, warning

### Expense

**Budget**:
A monthly expense allowance allocated to one division.
_Avoid_: Allowance, allocation

**Expense Request**:
A fund request, discriminated into Niche and Emergency variants.
_Avoid_: Fund request, reimbursement

**Niche Request**:
An expense request for a regular (non-emergency) need.
_Avoid_: Normal request, standard request

**Emergency Request**:
An expense request carrying an emergency level and usage justification.
_Avoid_: Urgent request, urgent fund

### Shared

**Approval**:
A recorded approval decision. Legacy implemented three independent approval tables (warehouse, trucking, expense); each is a distinct concept that happens to share a name, so always qualify which domain an Approval belongs to.
_Avoid_: Approver (that's the User), sign-off

### Environments

**Environment branch**:
A Neon branch that is an environment: `production`, a per-PR preview (`pr<N>-<slug>`, or the `pr-<N>` fallback), or a per-developer local branch (`dev-<slug>`). Qualify "branch" — environment branch, or git branch — whenever the bare word would be ambiguous; there is no standing dev branch (ADR-0028).
_Avoid_: dev branch (unqualified), DB branch

**Deployment environment**:
The GitHub environment a preview's web URL is registered under: `preview/pr-<n>`, one per pull request, deleted when the pull request closes (ADR-0019). It carries no data — a preview's data lives in its Neon environment branch — so qualify "environment" whenever the bare word could mean either.
_Avoid_: environment (unqualified), preview environment (that is the pull request's whole stack)

**Application database**:
The one database every environment branch carries: `app`. Branches differ in rows; the name does not. It is what the app migrates and what a Worker's `DATABASE_URL` points at.
_Avoid_: `vmb` as a database name (the pre-rename name), `neondb` (Neon's project default, removed by ADR-0029)

### Migration vocabulary

**Legacy snapshot**:
A `pg_dump` of the deployed legacy database; the source for the cutover rehearsal and cutover.

**Baseline**:
Migration `0000` — the legacy schema minus the excluded tables. Nothing is written against it.
_Avoid_: Legacy schema (that is the untrimmed dump)

**Excluded tables**:
Legacy tables deliberately not ported: Laravel runtime, Laravel auth, and the Spatie RBAC tables. `master.users` is retained in the baseline as a staging table until the identity transform lands.

**Replay**:
Bringing a database to the current shape by applying the ordered migration chain over a legacy snapshot.

**Deviation ledger**:
`docs/migration/deviations.md` — the itemized register of every intentional difference from legacy.

**Mechanical deviation**:
A schema fix that does not change meaning (types, constraints, indexes, defaults). Applied during the port.

**Semantic deviation**:
A change in meaning or model (normalising, splitting, dropping behaviour). Deferred to a migration over loaded data.

**Parity**:
The state in which imported data and behaviour match the legacy system closely enough for cutover.
