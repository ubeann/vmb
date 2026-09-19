import {
  index,
  text,
  timestamp,
  boolean,
  foreignKey,
  pgSchema,
  uuid,
  numeric,
  json,
  varchar
} from "drizzle-orm/pg-core";
import { divisions, users } from "./master.js";

export const expense = pgSchema("expense");

export const budgets = expense.table(
  "budgets",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    divisionId: uuid("division_id").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    amount: numeric({ precision: 15, scale: 2 }).default("0").notNull(),
    createdAt: timestamp("created_at", { precision: 0 }),
    updatedAt: timestamp("updated_at", { precision: 0 })
  },
  (table) => [
    foreignKey({
      columns: [table.divisionId],
      foreignColumns: [divisions.id],
      name: "expense_budgets_division_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade")
  ]
);

export const requestNicheDetails = expense.table(
  "request_niche_details",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    amount: numeric({ precision: 15, scale: 2 }).default("0").notNull(),
    notes: text(),
    supportingDocuments: json("supporting_documents"),
    invoicePaths: json("invoice_paths"),
    bankTransferProof: varchar("bank_transfer_proof", { length: 255 }),
    createdAt: timestamp("created_at", { precision: 0 }),
    updatedAt: timestamp("updated_at", { precision: 0 })
  },
  (table) => [
    foreignKey({
      columns: [table.requestId],
      foreignColumns: [requests.id],
      name: "expense_request_niche_details_request_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade")
  ]
);

export const requests = expense.table(
  "requests",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id"),
    divisionId: uuid("division_id").notNull(),
    type: varchar({ length: 255 }).notNull(),
    status: varchar({ length: 255 }).default("pending").notNull(),
    createdAt: timestamp("created_at", { precision: 0 }),
    updatedAt: timestamp("updated_at", { precision: 0 }),
    deletedAt: timestamp("deleted_at", { precision: 0 })
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
      .onDelete("set null")
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
    createdAt: timestamp("created_at", { precision: 0 }),
    updatedAt: timestamp("updated_at", { precision: 0 })
  },
  (table) => [
    index("approvable_index").using(
      "btree",
      table.approvableType.asc().nullsLast().op("text_ops"),
      table.approvableId.asc().nullsLast().op("uuid_ops")
    ),
    foreignKey({
      columns: [table.approverId],
      foreignColumns: [users.id],
      name: "expense_approvals_approver_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null")
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
    createdAt: timestamp("created_at", { precision: 0 }),
    updatedAt: timestamp("updated_at", { precision: 0 })
  },
  (table) => [
    foreignKey({
      columns: [table.requestId],
      foreignColumns: [requests.id],
      name: "expense_request_emergency_details_request_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade")
  ]
);
