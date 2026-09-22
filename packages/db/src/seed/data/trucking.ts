import { ID_GROUPS, fixtureId, softStamps, stamps } from "../ids.js";
import { table } from "../sql.js";
import { approvalTable } from "./approvals.js";
import { PREVIEW_USER_ID } from "./master.js";

/**
 * The trucking half of the preview dataset: enough rows per list to page and
 * filter, and one walkable path — client → order → trip → plan/actual →
 * invoice — for the UI. Statuses and enum values come from the legacy
 * vocabularies (`docs/research/legacy-schema-inventory.md`), not invented
 * ones, so the previews exercise the same states production will.
 */

const clientSeed = [
  { name: "PT Samudra Jaya", slug: "samudrajaya", pic: "Andi Kurniawan" },
  { name: "PT Anugerah Logistik", slug: "anugerahlogistik", pic: "Bella Kartika" },
  { name: "PT Bumi Sejahtera", slug: "bumisejahtera", pic: "Cahyo Prabowo" },
  { name: "PT Cakra Trans", slug: "cakratrans", pic: "Dian Puspita" },
  { name: "PT Dharma Kencana", slug: "dharmakencana", pic: "Erwin Santoso" },
  { name: "PT Elang Nusantara", slug: "elangnusantara", pic: "Farah Nadia" },
  { name: "PT Fajar Abadi", slug: "fajarabadi", pic: "Gilang Ramadhan" },
  { name: "PT Gemilang Perkasa", slug: "gemilangperkasa", pic: "Hana Salsabila" },
  { name: "PT Harapan Sentosa", slug: "harapansentosa", pic: "Indra Kusuma" },
  { name: "PT Intan Mandiri", slug: "intanmandiri", pic: "Jessica Tan" },
  { name: "PT Jaya Bersama", slug: "jayabersama", pic: "Kevin Halim" },
  { name: "PT Karya Utama", slug: "karyautama", pic: "Lestari Ningsih" }
];

const clients = table(
  "trucking.clients",
  [
    "id",
    "name",
    "code",
    "pic",
    "email",
    "phone",
    "address",
    "logo_path",
    "created_at",
    "updated_at",
    "deleted_at"
  ],
  clientSeed.map((client, position) => ({
    id: fixtureId(ID_GROUPS.client, position + 1),
    name: client.name,
    code: `CL-${String(position + 1).padStart(3, "0")}`,
    pic: client.pic,
    email: `logistics@${client.slug}.example`,
    phone: `+62 21-5550-${String(position + 1).padStart(4, "0")}`,
    address: `Jl. Pelabuhan No. ${position + 1}, Jakarta`,
    logo_path: null,
    ...softStamps(position + 1)
  }))
);

const clientTruckCompanySeed = [
  { client: 1, name: "Samudra Jaya Fleet", editableDtp: true },
  { client: 1, name: "Samudra Jaya Partner", editableDtp: false },
  { client: 2, name: "Anugerah Logistik Fleet", editableDtp: true },
  { client: 2, name: "Anugerah Logistik Partner", editableDtp: false },
  { client: 3, name: "Bumi Sejahtera Fleet", editableDtp: false },
  { client: 3, name: "Bumi Sejahtera Partner", editableDtp: false }
];

const clientTruckCompanies = table(
  "trucking.client_truck_companies",
  ["id", "client_id", "name", "editable_dtp", "created_at", "updated_at"],
  clientTruckCompanySeed.map((company, position) => ({
    id: fixtureId(ID_GROUPS.clientTruckCompany, position + 1),
    client_id: fixtureId(ID_GROUPS.client, company.client),
    name: company.name,
    editable_dtp: company.editableDtp,
    ...stamps(position + 1)
  }))
);

const driverSeed = [
  { name: "Sutrisno Hadi", birth: "1985-03-14" },
  { name: "Bambang Riyadi", birth: "1987-07-02" },
  { name: "Cecep Supriatna", birth: "1989-11-21" },
  { name: "Dedi Mulyadi", birth: "1990-01-09" },
  { name: "Endang Kusnadi", birth: "1986-05-30" },
  { name: "Feri Irawan", birth: "1992-08-17" },
  { name: "Gede Wirawan", birth: "1988-02-25" },
  { name: "Hendra Gunawan", birth: "1991-12-04" },
  { name: "Iwan Setiawan", birth: "1993-06-12" },
  { name: "Junaedi", birth: "1984-09-28" },
  { name: "Karto Wiyono", birth: "1987-04-06" },
  { name: "Lukman Hakim", birth: "1994-10-19" }
];

const drivers = table(
  "trucking.drivers",
  [
    "id",
    "name",
    "date_of_birth",
    "identification_number",
    "license_number",
    "phone",
    "address",
    "profile_photo_path",
    "created_at",
    "updated_at",
    "deleted_at"
  ],
  driverSeed.map((driver, position) => ({
    id: fixtureId(ID_GROUPS.driver, position + 1),
    name: driver.name,
    date_of_birth: driver.birth,
    identification_number: `3174010${String(100000 + position + 1).slice(-6)}0${position + 1}`,
    license_number: `SIM-B1-${2019 + (position % 5)}-${String(position + 1).padStart(4, "0")}`,
    phone: `+62 812-2000-${String(position + 1).padStart(4, "0")}`,
    address: `Jl. Raya Cakung No. ${position + 1}, Jakarta`,
    profile_photo_path: null,
    ...softStamps(position + 1)
  }))
);

const truckSeed = [
  { brand: "Hino", year: 2019 },
  { brand: "Isuzu", year: 2020 },
  { brand: "Mitsubishi Fuso", year: 2021 },
  { brand: "Scania", year: 2022 },
  { brand: "Hino", year: 2020 },
  { brand: "Isuzu", year: 2023 },
  { brand: "Mitsubishi Fuso", year: 2019 },
  { brand: "Scania", year: 2024 },
  { brand: "Hino", year: 2021 },
  { brand: "Isuzu", year: 2022 },
  { brand: "Mitsubishi Fuso", year: 2023 },
  { brand: "Scania", year: 2020 }
];

const trucks = table(
  "trucking.trucks",
  [
    "id",
    "license_plate",
    "brand",
    "production_year",
    "last_maintenance",
    "created_at",
    "updated_at",
    "deleted_at"
  ],
  truckSeed.map((truck, position) => ({
    id: fixtureId(ID_GROUPS.truck, position + 1),
    license_plate: `B ${String(9001 + position)} VMB`,
    brand: truck.brand,
    production_year: truck.year,
    last_maintenance: `2025-${String((position % 12) + 1).padStart(2, "0")}-15`,
    ...softStamps(position + 1)
  }))
);

const locationSeed = [
  { code: "JKT", name: "Jakarta" },
  { code: "SBY", name: "Surabaya" },
  { code: "BDG", name: "Bandung" },
  { code: "SMG", name: "Semarang" },
  { code: "MDN", name: "Medan" },
  { code: "MKS", name: "Makassar" },
  { code: "BPN", name: "Balikpapan" },
  { code: "PLM", name: "Palembang" },
  { code: "LPG", name: "Lampung" },
  { code: "PKU", name: "Pekanbaru" },
  { code: "DPS", name: "Denpasar" },
  { code: "JOG", name: "Yogyakarta" }
];

const locations = table(
  "trucking.locations",
  ["id", "code", "name", "created_at", "updated_at"],
  locationSeed.map((location, position) => ({
    id: fixtureId(ID_GROUPS.location, position + 1),
    code: location.code,
    name: location.name,
    ...stamps(position + 1)
  }))
);

/**
 * Route n's price snapshot: size alternates 20/40 so both container sizes
 * appear in every list, and every fifth route is a LOLO job. DTPs and DTAs
 * copy the same values, which is what the fee snapshot means.
 */
function routeSnapshot(route: number) {
  const isLolo = route % 5 === 0;
  return {
    size: route % 2 === 1 ? 20 : 40,
    fee: 1_500_000 + route * 150_000,
    allowance: 150_000 + route * 10_000,
    is_lolo: isLolo,
    lolo_fee: isLolo ? 250_000 : null
  };
}

const routes = table(
  "trucking.routes",
  ["id", "size", "fee", "allowance", "is_lolo", "created_at", "updated_at"],
  Array.from({ length: 12 }, (_, index) => {
    const route = index + 1;
    const snapshot = routeSnapshot(route);
    return {
      id: fixtureId(ID_GROUPS.route, route),
      size: snapshot.size,
      fee: snapshot.fee,
      allowance: snapshot.allowance,
      is_lolo: snapshot.is_lolo,
      ...stamps(route)
    };
  })
);

/** A route is three stops; the first is empty and the rest load full. */
function routeStops(route: number) {
  return Array.from({ length: 3 }, (_, index) => {
    const position = index + 1;
    const location = ((route + position - 2) % 12) + 1;
    return { position, location };
  });
}

/** The stop snapshot a trip (or a DTA's route change) stores as JSON. */
function routeStopsJson(route: number, gateLabel: boolean) {
  return routeStops(route).map((stop) => ({
    location: locationSeed[stop.location - 1]!.code,
    name: locationSeed[stop.location - 1]!.name,
    load_type: stop.position === 1 ? "E" : "F",
    is_visible: true,
    label: gateLabel && stop.position === 1 ? `Gate ${route}` : null
  }));
}

const routeLocations = table(
  "trucking.route_locations",
  [
    "id",
    "route_id",
    "location_id",
    "position",
    "load_type",
    "is_visible",
    "label",
    "created_at",
    "updated_at"
  ],
  Array.from({ length: 36 }, (_, index) => {
    const route = Math.floor(index / 3) + 1;
    const stop = routeStops(route)[index % 3]!;
    return {
      id: fixtureId(ID_GROUPS.routeLocation, index + 1),
      route_id: fixtureId(ID_GROUPS.route, route),
      location_id: fixtureId(ID_GROUPS.location, stop.location),
      position: stop.position,
      load_type: stop.position === 1 ? "E" : "F",
      is_visible: true,
      label: stop.position === 1 ? `Gate ${route}` : null,
      ...stamps(index + 1)
    };
  })
);

const clientRouteLinks: ReadonlyArray<readonly [client: number, route: number]> = [
  [1, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [2, 8]
];

const clientRoute = table(
  "trucking.client_route",
  ["client_id", "route_id", "created_at", "updated_at"],
  clientRouteLinks.map(([client, route], position) => ({
    client_id: fixtureId(ID_GROUPS.client, client),
    route_id: fixtureId(ID_GROUPS.route, route),
    ...stamps(position + 1)
  }))
);

const orderStatuses = [
  "pending_dtp",
  "submitting_dtp",
  "pending_dta",
  "submitting_dta",
  "waiting_bill",
  "invoice_generated",
  "submitting_for_payment",
  "completed",
  "assigning_trip",
  "cancelled",
  "rejected",
  "pending_dtp"
];

const orders = table(
  "trucking.orders",
  [
    "id",
    "client_id",
    "code",
    "type",
    "party_count",
    "status",
    "evidence_path",
    "direction",
    "trip_count",
    "additional_files",
    "additional_allowances",
    "reference_code",
    "client_truck_company_id",
    "reference_id",
    "cancelled_at",
    "cancelled_by",
    "cancel_reason",
    "custom_invoice_codes",
    "submitted_for_payment_at",
    "payment_received_at",
    "payment_documents",
    "payment_notes",
    "created_at",
    "updated_at",
    "deleted_at"
  ],
  Array.from({ length: 12 }, (_, index) => {
    const order = index + 1;
    const client = order;
    return {
      id: fixtureId(ID_GROUPS.order, order),
      client_id: fixtureId(ID_GROUPS.client, client),
      code: 1000 + order,
      type: "REG",
      party_count: (index % 3) + 1,
      status: orderStatuses[index]!,
      evidence_path: order === 4 ? `orders/${1000 + order}/evidence.pdf` : null,
      direction: order % 4 === 3 ? "export" : "import",
      trip_count: order <= 6 ? 1 : 0,
      additional_files:
        order === 2
          ? {
              json: [
                `orders/${1000 + order}/manifest.pdf`,
                `orders/${1000 + order}/packing-list.pdf`
              ]
            }
          : null,
      additional_allowances:
        order === 3 ? { json: [{ amount: 350_000, description: "Waiting time" }] } : null,
      reference_code: `REF-2026-${String(order).padStart(4, "0")}`,
      client_truck_company_id:
        order <= 3 ? fixtureId(ID_GROUPS.clientTruckCompany, (order - 1) * 2 + 1) : null,
      reference_id: order === 12 ? fixtureId(ID_GROUPS.order, 11) : null,
      cancelled_at: order === 10 ? "2026-01-04T09:30:00.000Z" : null,
      cancelled_by: order === 10 ? PREVIEW_USER_ID : null,
      cancel_reason: order === 10 ? "Client postponed the shipment" : null,
      custom_invoice_codes:
        order === 5 ? { json: { normal: "-N", changed: "-C", lolo: "-L" } } : null,
      submitted_for_payment_at: order === 8 ? "2026-01-04T10:00:00.000Z" : null,
      payment_received_at: order === 8 ? "2026-01-04T15:00:00.000Z" : null,
      payment_documents:
        order === 8
          ? {
              json: {
                invoice: `orders/${1000 + order}/invoice.pdf`,
                uploaded_at: "2026-01-04T10:00:00.000Z"
              }
            }
          : null,
      payment_notes: order === 8 ? "Settled in full" : null,
      ...softStamps(order)
    };
  })
);

/** Trip letters are per order: A, B, C… — the legacy `SetTrip` convention. */
function tripLetter(trip: number): string {
  return String.fromCharCode(64 + trip);
}

const trips = table(
  "trucking.trips",
  [
    "id",
    "order_id",
    "code",
    "total_units",
    "routes",
    "route_reference_id",
    "created_at",
    "updated_at"
  ],
  Array.from({ length: 6 }, (_, index) => {
    const trip = index + 1;
    return {
      id: fixtureId(ID_GROUPS.trip, trip),
      order_id: fixtureId(ID_GROUPS.order, trip),
      code: tripLetter(trip),
      total_units: (index % 3) + 2,
      routes: { json: routeStopsJson(trip, true) },
      route_reference_id: fixtureId(ID_GROUPS.route, trip),
      ...stamps(trip)
    };
  })
);

const dailyTruckingPlans = table(
  "trucking.daily_trucking_plans",
  [
    "id",
    "order_id",
    "truck_id",
    "user_id",
    "driver_id",
    "trip_id",
    "plan_code",
    "composite_code",
    "size",
    "fee",
    "allowance",
    "is_lolo",
    "lolo_fee",
    "route_reference",
    "created_at",
    "updated_at",
    "deleted_at"
  ],
  Array.from({ length: 12 }, (_, index) => {
    const trip = Math.floor(index / 2) + 1;
    const position = (index % 2) + 1;
    const route = trip;
    return {
      id: fixtureId(ID_GROUPS.dailyTruckingPlan, index + 1),
      order_id: fixtureId(ID_GROUPS.order, trip),
      truck_id: fixtureId(ID_GROUPS.truck, ((trip + position - 2) % 12) + 1),
      user_id: fixtureId(ID_GROUPS.user, ((trip + position - 2) % 12) + 1),
      driver_id: fixtureId(ID_GROUPS.driver, ((trip + position - 2) % 12) + 1),
      trip_id: fixtureId(ID_GROUPS.trip, trip),
      plan_code: String(position),
      composite_code: `${1000 + trip}${tripLetter(trip)}${position}`,
      ...routeSnapshot(route),
      route_reference: fixtureId(ID_GROUPS.route, route),
      ...softStamps(index + 1)
    };
  })
);

const dailyTruckingActuals = table(
  "trucking.daily_trucking_actuals",
  [
    "id",
    "daily_trucking_plan_id",
    "order_id",
    "truck_id",
    "user_id",
    "driver_id",
    "trip_id",
    "plan_code",
    "composite_code",
    "size",
    "fee",
    "allowance",
    "is_lolo",
    "lolo_fee",
    "route_reference",
    "changed_routes",
    "created_at",
    "updated_at",
    "deleted_at"
  ],
  Array.from({ length: 6 }, (_, index) => {
    const trip = index + 1;
    const route = trip;
    return {
      id: fixtureId(ID_GROUPS.dailyTruckingActual, trip),
      daily_trucking_plan_id: fixtureId(ID_GROUPS.dailyTruckingPlan, index * 2 + 1),
      order_id: fixtureId(ID_GROUPS.order, trip),
      truck_id: fixtureId(ID_GROUPS.truck, trip),
      user_id: fixtureId(ID_GROUPS.user, trip),
      driver_id: fixtureId(ID_GROUPS.driver, trip),
      trip_id: fixtureId(ID_GROUPS.trip, trip),
      plan_code: "1",
      composite_code: `${1000 + trip}${tripLetter(trip)}1`,
      ...routeSnapshot(route),
      route_reference: fixtureId(ID_GROUPS.route, route),
      changed_routes: trip === 3 ? { json: routeStopsJson(9, false) } : null,
      ...softStamps(trip)
    };
  })
);

const invoiceStatuses = [
  "receive_document",
  "approved",
  "documents_filled",
  "billing_settled",
  "tax_settled",
  "completed"
];

const invoices = table(
  "trucking.invoices",
  [
    "id",
    "client_id",
    "status",
    "countdown",
    "time_table_path",
    "list_container_full_path",
    "kwitansi_port_charge_path",
    "peb_path",
    "npe_path",
    "booking_shipping_line_path",
    "invoice_port_charge_path",
    "invoice_handling_path",
    "e_faktur_path",
    "additional_files",
    "notes",
    "amount_total",
    "amount_billed",
    "created_at",
    "updated_at",
    "deleted_at"
  ],
  Array.from({ length: 12 }, (_, index) => {
    const invoice = index + 1;
    const status = invoiceStatuses[index % 6]!;
    const filled = index % 6 >= 2;
    const settled = index % 6 >= 3;
    return {
      id: fixtureId(ID_GROUPS.invoice, invoice),
      client_id: fixtureId(ID_GROUPS.client, invoice),
      status,
      countdown: 12 - index,
      time_table_path: filled ? `invoices/${invoice}/time-table.pdf` : null,
      list_container_full_path: filled ? `invoices/${invoice}/containers.pdf` : null,
      kwitansi_port_charge_path: settled ? `invoices/${invoice}/kwitansi.pdf` : null,
      peb_path: filled ? `invoices/${invoice}/peb.pdf` : null,
      npe_path: filled ? `invoices/${invoice}/npe.pdf` : null,
      booking_shipping_line_path: settled ? `invoices/${invoice}/booking.pdf` : null,
      invoice_port_charge_path: settled ? `invoices/${invoice}/port-charge.pdf` : null,
      invoice_handling_path: settled ? `invoices/${invoice}/handling.pdf` : null,
      e_faktur_path: settled ? `invoices/${invoice}/e-faktur.pdf` : null,
      additional_files: invoice === 4 ? { json: [`invoices/${invoice}/supporting-doc.pdf`] } : null,
      notes: invoice === 5 ? "Awaiting tax settlement" : null,
      amount_total: filled ? 12_500_000 + invoice * 250_000 : null,
      amount_billed: settled ? 12_500_000 + invoice * 250_000 : null,
      ...softStamps(invoice)
    };
  })
);

const invoiceShipments = table(
  "trucking.invoice_shipments",
  [
    "id",
    "invoice_id",
    "vessel_name",
    "voyage",
    "shipping_agent",
    "etd",
    "booking_no",
    "actual_20_hc",
    "actual_40_hc",
    "dest_code",
    "bill_number",
    "order_number",
    "handling_pricing",
    "port_charge_20hc",
    "port_charge_40hc",
    "contact_name",
    "created_at",
    "updated_at"
  ],
  Array.from({ length: 6 }, (_, index) => {
    const shipment = index + 1;
    return {
      id: fixtureId(ID_GROUPS.invoiceShipment, shipment),
      invoice_id: fixtureId(ID_GROUPS.invoice, shipment),
      vessel_name: `MV Nusantara ${shipment}`,
      voyage: `V-2026${String(shipment).padStart(2, "0")}`,
      shipping_agent: `PT Agen Laut ${shipment}`,
      etd: `2026-02-${String(shipment + 9).padStart(2, "0")}`,
      booking_no: `BKG-2026-${String(shipment).padStart(4, "0")}`,
      actual_20_hc: shipment % 3,
      actual_40_hc: (shipment + 1) % 3,
      dest_code: locationSeed[shipment - 1]!.code,
      bill_number: `BL-2026-${String(shipment).padStart(4, "0")}`,
      order_number: `ORD-2026-${String(shipment).padStart(4, "0")}`,
      handling_pricing: 1_250_000 + shipment * 50_000,
      port_charge_20hc: 900_000,
      port_charge_40hc: 1_400_000,
      contact_name: clientSeed[shipment - 1]!.pic,
      ...stamps(shipment)
    };
  })
);

const invoiceVendors = table(
  "trucking.invoice_vendor",
  ["id", "invoice_id", "quantity", "unit_price", "description", "created_at", "updated_at"],
  Array.from({ length: 6 }, (_, index) => {
    const vendor = index + 1;
    return {
      id: fixtureId(ID_GROUPS.invoiceVendor, vendor),
      invoice_id: fixtureId(ID_GROUPS.invoice, vendor),
      quantity: (index % 3) + 1,
      unit_price: 750_000 + vendor * 25_000,
      description: `Trucking vendor line ${vendor}`,
      ...stamps(vendor)
    };
  })
);

const invoiceComments = table(
  "trucking.invoice_comments",
  ["id", "invoice_id", "user_id", "invoice_status", "comment", "created_at", "updated_at"],
  Array.from({ length: 6 }, (_, index) => {
    const comment = index + 1;
    const invoice = Math.floor(index / 2) + 1;
    const status = invoiceStatuses[(invoice - 1) % 6]!;
    return {
      id: fixtureId(ID_GROUPS.invoiceComment, comment),
      invoice_id: fixtureId(ID_GROUPS.invoice, invoice),
      user_id: index % 2 === 0 ? PREVIEW_USER_ID : fixtureId(ID_GROUPS.user, 2),
      invoice_status: status,
      comment: `Followed up with the client (${status})`,
      ...stamps(comment)
    };
  })
);

/**
 * The polymorphic target stores the legacy model's fully-qualified class name
 * — there was never a morph map — so the value is that string, not an id.
 */
const ORDER_MODEL = "App\\Models\\Trucking\\Order";

const approvals = approvalTable(
  "trucking.approvals",
  Array.from({ length: 6 }, (_, index) => {
    const approval = index + 1;
    const order = Math.floor(index / 2) + 1;
    const type = index % 2 === 0 ? "dtp" : "dta";
    return {
      id: fixtureId(ID_GROUPS.truckingApproval, approval),
      approvable_type: ORDER_MODEL,
      approvable_id: fixtureId(ID_GROUPS.order, order),
      approver_id: index % 2 === 0 ? PREVIEW_USER_ID : fixtureId(ID_GROUPS.user, 3),
      type,
      approved: true,
      comment: `${type.toUpperCase()} approved for preview`,
      ...stamps(approval)
    };
  })
);

export const truckingTables = [
  clients,
  clientTruckCompanies,
  drivers,
  trucks,
  locations,
  routes,
  routeLocations,
  clientRoute,
  orders,
  trips,
  dailyTruckingPlans,
  dailyTruckingActuals,
  invoices,
  invoiceShipments,
  invoiceVendors,
  invoiceComments,
  approvals
];
