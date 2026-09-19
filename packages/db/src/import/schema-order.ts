// The order rows must be inserted in: parents before children, derived from
// the foreign-key graph in `0001_legacy_baseline`. A test asserts it still
// covers every ported table and respects every edge, so a migration that adds
// or reshapes a key fails loudly rather than loading in a broken order.
export const schemaOrder = [
  "master.divisions",
  "master.users",
  "trucking.approvals",
  "trucking.clients",
  "trucking.drivers",
  "trucking.invoices",
  "trucking.locations",
  "trucking.routes",
  "trucking.trucks",
  "warehouse.approvals",
  "warehouse.items",
  "warehouse.procurement_quotations",
  "warehouse.procurement_requests",
  "warehouse.stock_requisitions",
  "expense.approvals",
  "expense.budgets",
  "expense.requests",
  "trucking.client_route",
  "trucking.client_truck_companies",
  "trucking.invoice_comments",
  "trucking.invoice_shipments",
  "trucking.invoice_vendor",
  "trucking.orders",
  "trucking.route_locations",
  "trucking.trips",
  "warehouse.stock_alerts",
  "expense.request_emergency_details",
  "expense.request_niche_details",
  "trucking.daily_trucking_plans",
  "trucking.daily_trucking_actuals"
];
