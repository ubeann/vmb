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
  json,
  varchar,
  check,
  integer,
  date,
  primaryKey
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./master.js";

export const trucking = pgSchema("trucking");

export const clients = trucking.table(
  "clients",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    name: varchar({ length: 255 }).notNull(),
    code: varchar({ length: 255 }).notNull(),
    pic: varchar({ length: 255 }),
    email: varchar({ length: 255 }),
    phone: varchar({ length: 255 }),
    address: text(),
    logoPath: varchar("logo_path", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    index("trucking_clients_name_index").using(
      "btree",
      table.name.asc().nullsLast().op("text_ops")
    ),
    unique("trucking_clients_code_unique").on(table.code),
    unique("trucking_clients_email_unique").on(table.email)
  ]
);

export const clientTruckCompanies = trucking.table(
  "client_truck_companies",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    clientId: uuid("client_id").notNull(),
    name: varchar({ length: 255 }).notNull(),
    editableDtp: boolean("editable_dtp").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: "trucking_client_truck_companies_client_id_foreign"
    }).onDelete("cascade"),
    unique("trucking_client_truck_companies_client_id_name_unique").on(table.clientId, table.name),
    index("trucking_client_truck_companies_name_index").using(
      "btree",
      table.name.asc().nullsLast().op("text_ops")
    )
  ]
);

export const approvals = trucking.table(
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
    index("approvable_index").using(
      "btree",
      table.approvableType.asc().nullsLast().op("text_ops"),
      table.approvableId.asc().nullsLast().op("uuid_ops")
    ),
    foreignKey({
      columns: [table.approverId],
      foreignColumns: [users.id],
      name: "trucking_approvals_approver_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("trucking_approvals_type_created_at_index").using(
      "btree",
      table.type.asc().nullsLast().op("text_ops"),
      table.createdAt.asc().nullsLast().op("timestamptz_ops")
    ),
    index("trucking_approvals_approver_id_index").using(
      "btree",
      table.approverId.asc().nullsLast().op("uuid_ops")
    )
  ]
);

export const dailyTruckingActuals = trucking.table(
  "daily_trucking_actuals",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    dailyTruckingPlanId: uuid("daily_trucking_plan_id").notNull(),
    orderId: uuid("order_id").notNull(),
    truckId: uuid("truck_id"),
    userId: uuid("user_id"),
    driverId: uuid("driver_id"),
    tripId: uuid("trip_id"),
    planCode: varchar("plan_code", { length: 255 }).notNull(),
    compositeCode: varchar("composite_code", { length: 255 }).notNull(),
    size: integer().notNull(),
    fee: numeric({ precision: 15, scale: 2 }).notNull(),
    allowance: numeric({ precision: 15, scale: 2 }).default("0").notNull(),
    isLolo: boolean("is_lolo").default(false).notNull(),
    loloFee: numeric("lolo_fee", { precision: 15, scale: 2 }),
    routeReference: varchar("route_reference", { length: 255 }).notNull(),
    changedRoutes: json("changed_routes"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    index("trucking_daily_trucking_actuals_daily_trucking_plan_id_index").using(
      "btree",
      table.dailyTruckingPlanId.asc().nullsLast().op("uuid_ops")
    ),
    index("trucking_daily_trucking_actuals_order_id_index").using(
      "btree",
      table.orderId.asc().nullsLast().op("uuid_ops")
    ),
    index("trucking_daily_trucking_actuals_truck_id_index").using(
      "btree",
      table.truckId.asc().nullsLast().op("uuid_ops")
    ),
    index("trucking_daily_trucking_actuals_user_id_index").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops")
    ),
    foreignKey({
      columns: [table.dailyTruckingPlanId],
      foreignColumns: [dailyTruckingPlans.id],
      name: "trucking_daily_trucking_actuals_daily_trucking_plan_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.driverId],
      foreignColumns: [drivers.id],
      name: "trucking_daily_trucking_actuals_driver_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.orderId],
      foreignColumns: [orders.id],
      name: "trucking_daily_trucking_actuals_order_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.tripId],
      foreignColumns: [trips.id],
      name: "trucking_daily_trucking_actuals_trip_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.truckId],
      foreignColumns: [trucks.id],
      name: "trucking_daily_trucking_actuals_truck_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "trucking_daily_trucking_actuals_user_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    unique("trucking_daily_trucking_actuals_trip_id_plan_code_unique").on(
      table.tripId,
      table.planCode
    ),
    index("trucking_daily_trucking_actuals_driver_id_index").using(
      "btree",
      table.driverId.asc().nullsLast().op("uuid_ops")
    )
  ]
);

export const orders = trucking.table(
  "orders",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    clientId: uuid("client_id").notNull(),
    code: integer().notNull(),
    type: varchar({ length: 255 }).notNull(),
    partyCount: integer("party_count").notNull(),
    status: varchar({ length: 255 }).notNull(),
    evidencePath: varchar("evidence_path", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
    direction: varchar({ length: 255 }).default("import").notNull(),
    tripCount: integer("trip_count").default(0).notNull(),
    additionalFiles: json("additional_files"),
    additionalAllowances: json("additional_allowances"),
    referenceCode: varchar("reference_code", { length: 255 }),
    clientTruckCompanyId: uuid("client_truck_company_id"),
    referenceId: uuid("reference_id"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, precision: 3 }),
    cancelledBy: uuid("cancelled_by"),
    cancelReason: text("cancel_reason"),
    customInvoiceCodes: json("custom_invoice_codes"),
    submittedForPaymentAt: timestamp("submitted_for_payment_at", {
      withTimezone: true,
      precision: 3
    }),
    paymentReceivedAt: timestamp("payment_received_at", { withTimezone: true, precision: 3 }),
    paymentDocuments: json("payment_documents"),
    paymentNotes: text("payment_notes")
  },
  (table) => [
    index("trucking_orders_client_id_index").using(
      "btree",
      table.clientId.asc().nullsLast().op("uuid_ops")
    ),
    index("trucking_orders_client_truck_company_id_index").using(
      "btree",
      table.clientTruckCompanyId.asc().nullsLast().op("uuid_ops")
    ),
    foreignKey({
      columns: [table.cancelledBy],
      foreignColumns: [users.id],
      name: "trucking_orders_cancelled_by_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: "trucking_orders_client_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.clientTruckCompanyId],
      foreignColumns: [clientTruckCompanies.id],
      name: "trucking_orders_client_truck_company_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.referenceId],
      foreignColumns: [table.id],
      name: "trucking_orders_reference_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    unique("trucking_orders_code_unique").on(table.code),
    index("trucking_orders_status_created_at_index").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops"),
      table.createdAt.asc().nullsLast().op("timestamptz_ops")
    ),
    index("trucking_orders_reference_id_index").using(
      "btree",
      table.referenceId.asc().nullsLast().op("uuid_ops")
    ),
    index("trucking_orders_cancelled_by_index").using(
      "btree",
      table.cancelledBy.asc().nullsLast().op("uuid_ops")
    )
  ]
);

export const invoiceShipments = trucking.table(
  "invoice_shipments",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    invoiceId: uuid("invoice_id").notNull(),
    vesselName: varchar("vessel_name", { length: 255 }),
    voyage: varchar({ length: 255 }),
    shippingAgent: varchar("shipping_agent", { length: 255 }),
    etd: date(),
    bookingNo: varchar("booking_no", { length: 255 }),
    actual20Hc: integer("actual_20_hc").default(0).notNull(),
    actual40Hc: integer("actual_40_hc").default(0).notNull(),
    destCode: varchar("dest_code", { length: 255 }),
    billNumber: varchar("bill_number", { length: 255 }),
    orderNumber: varchar("order_number", { length: 255 }),
    handlingPricing: numeric("handling_pricing", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    portCharge20Hc: numeric("port_charge_20hc", { precision: 12, scale: 2 }).default("0").notNull(),
    portCharge40Hc: numeric("port_charge_40hc", { precision: 12, scale: 2 }).default("0").notNull(),
    contactName: varchar("contact_name", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    foreignKey({
      columns: [table.invoiceId],
      foreignColumns: [invoices.id],
      name: "trucking_invoice_shipments_invoice_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade")
  ]
);

export const invoiceVendor = trucking.table(
  "invoice_vendor",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    invoiceId: uuid("invoice_id").notNull(),
    quantity: integer().default(0).notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0").notNull(),
    description: varchar({ length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    foreignKey({
      columns: [table.invoiceId],
      foreignColumns: [invoices.id],
      name: "trucking_invoice_vendor_invoice_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("trucking_invoice_vendor_invoice_id_index").using(
      "btree",
      table.invoiceId.asc().nullsLast().op("uuid_ops")
    )
  ]
);

export const locations = trucking.table(
  "locations",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    code: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
  },
  (table) => [unique("trucking_locations_code_unique").on(table.code)]
);

export const trips = trucking.table(
  "trips",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    orderId: uuid("order_id").notNull(),
    code: varchar({ length: 255 }).notNull(),
    totalUnits: integer("total_units").notNull(),
    routes: json().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }),
    routeReferenceId: uuid("route_reference_id")
  },
  (table) => [
    index("trucking_trips_code_index").using("btree", table.code.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.orderId],
      foreignColumns: [orders.id],
      name: "trucking_trips_order_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.routeReferenceId],
      foreignColumns: [routes.id],
      name: "trucking_trips_route_reference_id_foreign"
    }).onDelete("set null"),
    unique("trucking_trips_order_id_code_unique").on(table.orderId, table.code),
    index("trucking_trips_route_reference_id_index").using(
      "btree",
      table.routeReferenceId.asc().nullsLast().op("uuid_ops")
    )
  ]
);

export const trucks = trucking.table(
  "trucks",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    licensePlate: varchar("license_plate", { length: 255 }).notNull(),
    brand: varchar({ length: 255 }).notNull(),
    productionYear: integer("production_year").notNull(),
    lastMaintenance: date("last_maintenance").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 })
  },
  (table) => [unique("trucking_trucks_license_plate_unique").on(table.licensePlate)]
);

export const invoices = trucking.table(
  "invoices",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    clientId: uuid("client_id").notNull(),
    status: varchar({ length: 255 }).default("receive_document").notNull(),
    countdown: integer().default(0).notNull(),
    timeTablePath: varchar("time_table_path", { length: 255 }),
    listContainerFullPath: varchar("list_container_full_path", { length: 255 }),
    kwitansiPortChargePath: varchar("kwitansi_port_charge_path", { length: 255 }),
    pebPath: varchar("peb_path", { length: 255 }),
    npePath: varchar("npe_path", { length: 255 }),
    bookingShippingLinePath: varchar("booking_shipping_line_path", { length: 255 }),
    invoicePortChargePath: varchar("invoice_port_charge_path", { length: 255 }),
    invoiceHandlingPath: varchar("invoice_handling_path", { length: 255 }),
    eFakturPath: varchar("e_faktur_path", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
    additionalFiles: json("additional_files"),
    notes: text(),
    amountTotal: numeric("amount_total", { precision: 15, scale: 2 }),
    amountBilled: numeric("amount_billed", { precision: 15, scale: 2 })
  },
  (table) => [
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: "trucking_invoices_client_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("trucking_invoices_client_id_status_index").using(
      "btree",
      table.clientId.asc().nullsLast().op("uuid_ops"),
      table.status.asc().nullsLast().op("text_ops")
    )
  ]
);

export const routes = trucking.table(
  "routes",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    size: integer().notNull(),
    fee: numeric({ precision: 15, scale: 2 }).notNull(),
    allowance: numeric({ precision: 15, scale: 2 }).default("0").notNull(),
    isLolo: boolean("is_lolo").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    index("trucking_routes_size_index").using("btree", table.size.asc().nullsLast().op("int4_ops"))
  ]
);

export const dailyTruckingPlans = trucking.table(
  "daily_trucking_plans",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    orderId: uuid("order_id").notNull(),
    truckId: uuid("truck_id"),
    userId: uuid("user_id"),
    driverId: uuid("driver_id"),
    tripId: uuid("trip_id"),
    planCode: varchar("plan_code", { length: 255 }).notNull(),
    compositeCode: varchar("composite_code", { length: 255 }).notNull(),
    size: integer().notNull(),
    fee: numeric({ precision: 15, scale: 2 }).notNull(),
    allowance: numeric({ precision: 15, scale: 2 }).default("0").notNull(),
    isLolo: boolean("is_lolo").default(false).notNull(),
    loloFee: numeric("lolo_fee", { precision: 15, scale: 2 }),
    routeReference: varchar("route_reference", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    index("trucking_daily_trucking_plans_order_id_index").using(
      "btree",
      table.orderId.asc().nullsLast().op("uuid_ops")
    ),
    index("trucking_daily_trucking_plans_truck_id_index").using(
      "btree",
      table.truckId.asc().nullsLast().op("uuid_ops")
    ),
    index("trucking_daily_trucking_plans_user_id_index").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops")
    ),
    foreignKey({
      columns: [table.driverId],
      foreignColumns: [drivers.id],
      name: "trucking_daily_trucking_plans_driver_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.orderId],
      foreignColumns: [orders.id],
      name: "trucking_daily_trucking_plans_order_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.tripId],
      foreignColumns: [trips.id],
      name: "trucking_daily_trucking_plans_trip_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.truckId],
      foreignColumns: [trucks.id],
      name: "trucking_daily_trucking_plans_truck_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "trucking_daily_trucking_plans_user_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    unique("trucking_daily_trucking_plans_trip_id_plan_code_unique").on(
      table.tripId,
      table.planCode
    ),
    index("trucking_daily_trucking_plans_driver_id_index").using(
      "btree",
      table.driverId.asc().nullsLast().op("uuid_ops")
    )
  ]
);

export const drivers = trucking.table(
  "drivers",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    name: varchar({ length: 255 }).notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    identificationNumber: varchar("identification_number", { length: 255 }).notNull(),
    licenseNumber: varchar("license_number", { length: 255 }).notNull(),
    phone: varchar({ length: 20 }).notNull(),
    address: text().notNull(),
    profilePhotoPath: varchar("profile_photo_path", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    index("trucking_drivers_name_index").using(
      "btree",
      table.name.asc().nullsLast().op("text_ops")
    ),
    unique("trucking_drivers_identification_number_unique").on(table.identificationNumber),
    unique("trucking_drivers_license_number_unique").on(table.licenseNumber),
    unique("trucking_drivers_phone_unique").on(table.phone)
  ]
);

export const routeLocations = trucking.table(
  "route_locations",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    routeId: uuid("route_id").notNull(),
    locationId: uuid("location_id").notNull(),
    position: integer().notNull(),
    loadType: varchar("load_type", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }),
    isVisible: boolean("is_visible").default(true).notNull(),
    label: varchar({ length: 255 })
  },
  (table) => [
    index("trucking_route_locations_load_type_index").using(
      "btree",
      table.loadType.asc().nullsLast().op("text_ops")
    ),
    index("trucking_route_locations_location_id_index").using(
      "btree",
      table.locationId.asc().nullsLast().op("uuid_ops")
    ),
    index("trucking_route_locations_position_index").using(
      "btree",
      table.position.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locations.id],
      name: "trucking_route_locations_location_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.routeId],
      foreignColumns: [routes.id],
      name: "trucking_route_locations_route_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    check(
      "route_locations_load_type_check",
      sql`(load_type)::text = ANY (ARRAY[('E'::character varying)::text, ('F'::character varying)::text])`
    ),
    unique("trucking_route_locations_route_id_position_unique").on(table.routeId, table.position)
  ]
);

export const clientRoute = trucking.table(
  "client_route",
  {
    clientId: uuid("client_id").notNull(),
    routeId: uuid("route_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    index("trucking_client_route_route_id_index").using(
      "btree",
      table.routeId.asc().nullsLast().op("uuid_ops")
    ),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: "trucking_client_route_client_id_foreign"
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.routeId],
      foreignColumns: [routes.id],
      name: "trucking_client_route_route_id_foreign"
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.clientId, table.routeId],
      name: "client_route_pkey"
    })
  ]
);

export const invoiceComments = trucking.table(
  "invoice_comments",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    invoiceId: uuid("invoice_id").notNull(),
    userId: uuid("user_id"),
    invoiceStatus: varchar("invoice_status", { length: 50 }).notNull(),
    comment: text(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
  },
  (table) => [
    index("trucking_invoice_comments_invoice_id_created_at_index").using(
      "btree",
      table.invoiceId.asc().nullsLast().op("uuid_ops"),
      table.createdAt.asc().nullsLast().op("timestamptz_ops")
    ),
    index("trucking_invoice_comments_user_id_index").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops")
    ),
    foreignKey({
      columns: [table.invoiceId],
      foreignColumns: [invoices.id],
      name: "trucking_invoice_comments_invoice_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "trucking_invoice_comments_user_id_foreign"
    })
      .onUpdate("cascade")
      .onDelete("set null")
  ]
);
