import {
  index,
  text,
  timestamp,
  boolean,
  unique,
  foreignKey,
  pgSchema,
  uuid,
  numeric,
  json,
  check,
  varchar
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { divisions, users } from "./master.js";

export const expense = pgSchema("expense");

export const budgets = expense.table(
  "budgets",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    divisionId: uuid("division_id").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    amount: numeric({ precision: 15, scale: 2 }).default("0").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    foreignKey({
      columns: [table.divisionId],
      foreignColumns: [divisions.id],
      name: "expense_budgets_division_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("expense_budgets_division_id_unique").on(table.divisionId),
    check("expense_budgets_amount_check", sql`${table.amount} >= 0`)
  ]
);

export const requestNicheDetails = expense.table(
  "request_niche_details",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    amount: numeric({ precision: 15, scale: 2 }).default("0").notNull(),
    notes: text().notNull(),
    supportingDocuments: json("supporting_documents"),
    invoicePaths: json("invoice_paths"),
    bankTransferProof: varchar("bank_transfer_proof", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    foreignKey({
      columns: [table.requestId],
      foreignColumns: [requests.id],
      name: "expense_request_niche_details_request_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("expense_request_niche_details_request_id_unique").on(table.requestId)
  ]
);

export const requests = expense.table(
  "requests",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id"),
    divisionId: uuid("division_id").notNull(),
    type: varchar({ length: 255 }).notNull(),
    status: varchar({ length: 255 }).default("PENDING").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    foreignKey({
      columns: [table.divisionId],
      foreignColumns: [divisions.id],
      name: "expense_requests_division_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "expense_requests_user_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("expense_requests_division_id_status_created_at_index").using(
      "btree",
      table.divisionId.asc().nullsLast().op("uuid_ops"),
      table.status.asc().nullsLast().op("text_ops"),
      table.createdAt.asc().nullsLast().op("timestamptz_ops")
    ),
    index("expense_requests_user_id_index").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops")
    ),
    check("expense_requests_type_check", sql`${table.type} in ('NICHE', 'EMERGENCY')`),
    check(
      "expense_requests_status_check",
      sql`${table.status} in ('PENDING', 'WAITING_FOR_SUPPORTING_DOCUMENTS', 'SUBMITTING_SUPPORTING_DOCUMENTS', 'COMPLETED', 'REJECTED')`
    )
  ]
);

export const approvals = expense.table(
  "approvals",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    approvableType: varchar("approvable_type", { length: 255 }).notNull(),
    approvableId: uuid("approvable_id").notNull(),
    approverId: uuid("approver_id"),
    type: varchar({ length: 255 }).notNull(),
    approved: boolean().default(false).notNull(),
    comment: text(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    foreignKey({
      columns: [table.approverId],
      foreignColumns: [users.id],
      name: "expense_approvals_approver_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("expense_approvals_approver_id_index").using(
      "btree",
      table.approverId.asc().nullsLast().op("uuid_ops")
    ),
    unique("expense_approvals_approvable_type_approvable_id_type_unique").on(
      table.approvableType,
      table.approvableId,
      table.type
    )
  ]
);

export const requestEmergencyDetails = expense.table(
  "request_emergency_details",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    category: varchar({ length: 255 }).notNull(),
    amount: numeric({ precision: 15, scale: 2 }).default("0").notNull(),
    budgetUsage: text("budget_usage").notNull(),
    notes: text(),
    supportingDocuments: json("supporting_documents"),
    invoicePaths: json("invoice_paths"),
    bankTransferProof: varchar("bank_transfer_proof", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    foreignKey({
      columns: [table.requestId],
      foreignColumns: [requests.id],
      name: "expense_request_emergency_details_request_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("expense_request_emergency_details_request_id_unique").on(table.requestId),
    check(
      "expense_request_emergency_details_category_check",
      sql`${table.category} in ('1', '2', '3', '4', '5')`
    )
  ]
);
