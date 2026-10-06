# ADR-0045: Permissions are enforced at the API, from role grants

**Context:** #8 needs a rule for who may do what. Until now `requireSession` only proved someone was signed in, so any signed-in user could create users or delete roles. Legacy decided access in Spatie with a `Gate::before` bypass for Super Admin, divisions compared by name in 58 places, and a catalogue synced from code that hard-deleted whatever code no longer listed. `docs/research/master-entities-review.md` records the findings and the legacy `revamp` branch's design this follows.

**Options considered:**

- **Check permissions in each SvelteKit load and action.** Hides screens, but the API stays open to anyone who can send it a request.
- **A Super Admin bypass in code.** One more mechanism to audit, and the role matrix stops being the whole truth.
- **Roles carry permission grants, and the API checks them on every route.** Chosen.

**Decision:**

- A **Role** grants **Permissions** (`master.role_permissions`); a **User** holds Roles (`master.user_roles`). A user's permissions are the union of their **active** roles' grants. Nothing subtracts, and an inactive role grants nothing.
- The catalogue of permissions is defined in code (`packages/types/src/permissions.ts`) and projected into `master.permissions`. The Roles screen edits grants; nobody edits the catalogue by hand. A key leaves the catalogue by an explicit migration, never by a sync.
- Every `/api/master/*` route names the one permission it needs (`requirePermission("master-users.create")`) and answers 403 without it. A test lists every route with its key, so an unguarded route or a wrong key fails.
- Super Admin is a System Role holding every key through ordinary grants. There is no environment-variable user id, no role-name check and no bypass; a test fails if a catalogue key has no Super Admin grant.
- **Division scopes a role, and never grants.** `roles.division_id` says where a role operates (null: everywhere). Code never compares division names.
- The caller's own access is `GET /api/me`, open to every signed-in user: the shell reads permissions and division from it instead of from the Users and Divisions resources, which only someone permitted to read them may call.

**Trade-offs:** One extra indexed query per protected request (permissions are not cached, so a revoked grant takes effect on the next request, matching ADR-0034's reasoning for sessions). Until roles are assigned to users, nobody holds a permission, so a database without role data refuses every Master route; the legacy RBAC export must run before cutover, and previews are seeded so they work. The web hides what the API would refuse as a courtesy only; the API is the enforcement.
