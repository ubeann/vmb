-- The permission catalogue (packages/types/src/permissions.ts) as of this migration.
-- A key joins or leaves the catalogue by a migration like this one, never by a
-- sync that deletes (ADR-0045); rbac.test.ts fails when the two drift apart.
INSERT INTO "master"."permissions" ("key", "resource", "action") VALUES
  ('master-divisions.view_any', 'master-divisions', 'view_any'),
  ('master-divisions.view', 'master-divisions', 'view'),
  ('master-divisions.create', 'master-divisions', 'create'),
  ('master-divisions.update', 'master-divisions', 'update'),
  ('master-divisions.delete', 'master-divisions', 'delete'),
  ('master-divisions.delete_any', 'master-divisions', 'delete_any'),
  ('master-divisions.restore', 'master-divisions', 'restore'),
  ('master-divisions.restore_any', 'master-divisions', 'restore_any'),
  ('master-divisions.manager', 'master-divisions', 'manager'),
  ('master-roles.view_any', 'master-roles', 'view_any'),
  ('master-roles.view', 'master-roles', 'view'),
  ('master-roles.create', 'master-roles', 'create'),
  ('master-roles.update', 'master-roles', 'update'),
  ('master-roles.delete', 'master-roles', 'delete'),
  ('master-roles.delete_any', 'master-roles', 'delete_any'),
  ('master-users.view_any', 'master-users', 'view_any'),
  ('master-users.view', 'master-users', 'view'),
  ('master-users.create', 'master-users', 'create'),
  ('master-users.update', 'master-users', 'update'),
  ('master-users.delete', 'master-users', 'delete'),
  ('master-users.delete_any', 'master-users', 'delete_any'),
  ('master-users.restore', 'master-users', 'restore'),
  ('master-users.restore_any', 'master-users', 'restore_any')
ON CONFLICT ("key") DO NOTHING;
