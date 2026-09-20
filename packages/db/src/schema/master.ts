import {
  index,
  text,
  timestamp,
  unique,
  boolean,
  foreignKey,
  pgSchema,
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
    password: varchar({ length: 255 }).notNull(),
    rememberToken: varchar("remember_token", { length: 100 }),
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
