// Better Auth's default schema (ADR-0012), kept as the canonical shape
// `better-auth/adapters/drizzle` expects. The first four tables were pulled
// from the database; `rateLimit` was added later, after Better Auth's model:
// https://www.better-auth.com/docs/adapters/drizzle
import {
  pgTable,
  index,
  text,
  timestamp,
  unique,
  boolean,
  foreignKey,
  integer,
  bigint
} from "drizzle-orm/pg-core";

export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull()
  },
  (table) => [
    index("verification_identifier_idx").using(
      "btree",
      table.identifier.asc().nullsLast().op("text_ops")
    )
  ]
);

export const user = pgTable(
  "user",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull()
  },
  (table) => [unique("user_email_unique").on(table.email)]
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey().notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
      precision: 3
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
      precision: 3
    }),
    scope: text(),
    password: text(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull()
  },
  (table) => [
    index("account_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "account_user_id_user_id_fk"
    }).onDelete("cascade")
  ]
);

export const session = pgTable(
  "session",
  {
    id: text().primaryKey().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
    token: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull()
  },
  (table) => [
    index("session_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "session_user_id_user_id_fk"
    }).onDelete("cascade"),
    unique("session_token_unique").on(table.token)
  ]
);

// Better Auth's rate-limit counters (ADR-0042), as its 1.7 schema defines
// them: one row per client IP and path. `last_request` is epoch
// milliseconds, which outgrows an integer.
export const rateLimit = pgTable(
  "rate_limit",
  {
    id: text().primaryKey().notNull(),
    key: text().notNull(),
    count: integer().notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull()
  },
  (table) => [unique("rate_limit_key_unique").on(table.key)]
);
