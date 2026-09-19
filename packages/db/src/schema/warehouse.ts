import {
  index,
  text,
  timestamp,
  unique,
  boolean,
  foreignKey,
  pgSchema,
  uuid,
  numeric,
  varchar,
  integer
} from "drizzle-orm/pg-core";
import { divisions, users } from "./master.js";

export const warehouse = pgSchema("warehouse");

export const approvals = warehouse.table(
  "approvals",
  {
    id: uuid().primaryKey().notNull(),
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
      name: "warehouse_approvals_approver_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null")
  ]
);

export const stockAlerts = warehouse.table(
  "stock_alerts",
  {
    id: uuid().primaryKey().notNull(),
    itemId: uuid("item_id").notNull(),
    lastStock: integer("last_stock").notNull(),
    lastRequisitionId: uuid("last_requisition_id").notNull(),
    createdAt: timestamp("created_at", { precision: 0 }),
    updatedAt: timestamp("updated_at", { precision: 0 })
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [items.id],
      name: "warehouse_stock_alerts_item_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.lastRequisitionId],
      foreignColumns: [stockRequisitions.id],
      name: "warehouse_stock_alerts_last_requisition_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null")
  ]
);

export const procurementQuotations = warehouse.table("procurement_quotations", {
  id: uuid().primaryKey().notNull(),
  quotedPrice: numeric("quoted_price", { precision: 10, scale: 2 }).notNull(),
  vendorName: varchar("vendor_name", { length: 255 }).notNull(),
  vendorWebsite: varchar("vendor_website", { length: 255 }).notNull(),
  vendorPhone: varchar("vendor_phone", { length: 255 }),
  invoiceUrl: varchar("invoice_url", { length: 255 }),
  invoiceFilePath: varchar("invoice_file_path", { length: 255 }),
  paymentAccount: varchar("payment_account", { length: 255 }).notNull(),
  paymentProofPath: varchar("payment_proof_path", { length: 255 }),
  paymentDate: timestamp("payment_date", { precision: 0 }),
  receiptProofPath: varchar("receipt_proof_path", { length: 255 }),
  receiptDate: timestamp("receipt_date", { precision: 0 }),
  createdAt: timestamp("created_at", { precision: 0 }),
  updatedAt: timestamp("updated_at", { precision: 0 })
});

export const items = warehouse.table(
  "items",
  {
    id: uuid().primaryKey().notNull(),
    divisionId: uuid("division_id").notNull(),
    name: varchar({ length: 255 }).notNull(),
    code: varchar({ length: 255 }),
    description: text(),
    iconName: varchar("icon_name", { length: 255 }).default("heroicon-o-cube").notNull(),
    currentStock: integer("current_stock").default(0).notNull(),
    reorderLevel: integer("reorder_level").default(0).notNull(),
    createdAt: timestamp("created_at", { precision: 0 }),
    updatedAt: timestamp("updated_at", { precision: 0 })
  },
  (table) => [
    foreignKey({
      columns: [table.divisionId],
      foreignColumns: [divisions.id],
      name: "warehouse_items_division_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("warehouse_items_code_unique").on(table.code)
  ]
);

export const procurementRequests = warehouse.table(
  "procurement_requests",
  {
    id: uuid().primaryKey().notNull(),
    requestNumber: varchar("request_number", { length: 255 }).notNull(),
    requesterId: uuid("requester_id").notNull(),
    itemId: uuid("item_id").notNull(),
    status: varchar({ length: 255 }).default("pending").notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    requestedQuantity: integer("requested_quantity").notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    justification: text().notNull(),
    quotationId: uuid("quotation_id"),
    createdAt: timestamp("created_at", { precision: 0 }),
    updatedAt: timestamp("updated_at", { precision: 0 }),
    completedAt: timestamp("completed_at", { precision: 0 })
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [items.id],
      name: "warehouse_procurement_requests_item_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.quotationId],
      foreignColumns: [procurementQuotations.id],
      name: "warehouse_procurement_requests_quotation_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.requesterId],
      foreignColumns: [users.id],
      name: "warehouse_procurement_requests_requester_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("warehouse_procurement_requests_request_number_unique").on(table.requestNumber)
  ]
);

export const stockRequisitions = warehouse.table(
  "stock_requisitions",
  {
    id: uuid().primaryKey().notNull(),
    requisitionNumber: varchar("requisition_number", { length: 255 }).notNull(),
    requesterId: uuid("requester_id").notNull(),
    itemId: uuid("item_id").notNull(),
    status: varchar({ length: 255 }).default("pending").notNull(),
    requestedQuantity: integer("requested_quantity").notNull(),
    stockOnHand: integer("stock_on_hand"),
    purpose: text().notNull(),
    createdAt: timestamp("created_at", { precision: 0 }),
    updatedAt: timestamp("updated_at", { precision: 0 }),
    completedAt: timestamp("completed_at", { precision: 0 })
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [items.id],
      name: "warehouse_stock_requisitions_item_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.requesterId],
      foreignColumns: [users.id],
      name: "warehouse_stock_requisitions_requester_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("warehouse_stock_requisitions_requisition_number_unique").on(table.requisitionNumber)
  ]
);
