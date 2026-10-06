import {
  index,
  integer,
  json,
  text,
  timestamp,
  unique,
  boolean,
  foreignKey,
  pgSchema,
  primaryKey,
  uuid,
  varchar,
  check
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const master = pgSchema("master");

export const divisions = master.table(
  "divisions",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    name: varchar({ length: 255 }).notNull(),
    code: varchar({ length: 255 }).notNull(),
    description: text(),
    colorHex: varchar("color_hex", { length: 255 }).default("#000000").notNull(),
    iconName: varchar("icon_name", { length: 255 }).default("heroicon-o-rocket-launch").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    unique("master_divisions_name_unique").on(table.name),
    unique("master_divisions_code_unique").on(table.code)
  ]
);

// Recreated in the legacy shape while #8 decides the replacement RBAC model:
// `guard_name`, `level`, `is_system` and `metadata` are Spatie/custom columns
// the admin panel reads today. Permissions and role assignments are not ported
// yet; their tables stay #8's design (deviations ledger D-003).
export const roles = master.table(
  "roles",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    name: varchar({ length: 255 }).notNull(),
    guardName: varchar("guard_name", { length: 255 }).notNull(),
    level: integer().default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    isSystem: boolean("is_system").default(false).notNull(),
    colorHex: varchar("color_hex", { length: 255 }).default("#000000").notNull(),
    iconName: varchar("icon_name", { length: 255 }).default("heroicon-o-rocket-launch").notNull(),
    description: varchar({ length: 255 }),
    metadata: json(),
    // The division a role operates in; null means every division (Super Admin,
    // Executive). Division scopes a role and never grants anything itself.
    divisionId: uuid("division_id"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    unique("master_roles_name_guard_name_unique").on(table.name, table.guardName),
    foreignKey({
      columns: [table.divisionId],
      foreignColumns: [divisions.id],
      name: "master_roles_division_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    index("master_roles_division_id_index").using(
      "btree",
      table.divisionId.asc().nullsLast().op("uuid_ops")
    )
  ]
);

// The permission catalogue: one row per capability, keyed by the same
// `resource.action` string the code checks (`master-users.view_any`). The
// catalogue is defined in code and projected into this table so role grants
// can carry a foreign key; the table is never edited by hand.
export const permissions = master.table(
  "permissions",
  {
    key: text().primaryKey().notNull(),
    resource: text().notNull(),
    action: text().notNull(),
    description: text()
  },
  (table) => [
    unique("master_permissions_resource_action_unique").on(table.resource, table.action),
    check("permissions_key_check", sql`${table.key} = ${table.resource} || '.' || ${table.action}`)
  ]
);

// Which permissions a role grants. A grant is part of its role, so it goes when
// the role does, and a permission leaves the catalogue only with its grants.
export const rolePermissions = master.table(
  "role_permissions",
  {
    roleId: uuid("role_id").notNull(),
    permissionKey: text("permission_key").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionKey], name: "role_permissions_pkey" }),
    foreignKey({
      columns: [table.roleId],
      foreignColumns: [roles.id],
      name: "master_role_permissions_role_id_foreign"
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.permissionKey],
      foreignColumns: [permissions.key],
      name: "master_role_permissions_permission_key_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("master_role_permissions_permission_key_index").on(table.permissionKey)
  ]
);

// The durable business record (ADR-0032). The legacy auth columns — `password`
// and `remember_token` — were dropped by migration 0026: Better Auth owns
// credentials in `public.account`, and migrated accounts activate by email OTP
// rather than carrying a bcrypt hash (ADR-0033).
export const users = master.table(
  "users",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    name: varchar({ length: 255 }).notNull(),
    status: varchar({ length: 255 }).default("active").notNull(),
    divisionId: uuid("division_id"),
    phone: varchar({ length: 20 }),
    email: varchar({ length: 255 }).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, precision: 3 }),
    profilePhotoPath: varchar("profile_photo_path", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    foreignKey({
      columns: [table.divisionId],
      foreignColumns: [divisions.id],
      name: "master_users_division_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("master_users_division_id_index").using(
      "btree",
      table.divisionId.asc().nullsLast().op("uuid_ops")
    ),
    unique("master_users_email_unique").on(table.email),
    check(
      "users_status_check",
      sql`(status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('suspended'::character varying)::text])`
    )
  ]
);

// Which roles a user holds. Permissions reach a user only through this table,
// as the union of its roles' grants: nothing here can subtract. A role in use
// cannot be deleted (`restrict`), so deleting one never silently strips access;
// a user's own assignments go with the user.
export const userRoles = master.table(
  "user_roles",
  {
    userId: uuid("user_id").notNull(),
    roleId: uuid("role_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId], name: "user_roles_pkey" }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "master_user_roles_user_id_foreign"
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.roleId],
      foreignColumns: [roles.id],
      name: "master_user_roles_role_id_foreign"
    }).onDelete("restrict"),
    index("master_user_roles_role_id_index").on(table.roleId)
  ]
);
