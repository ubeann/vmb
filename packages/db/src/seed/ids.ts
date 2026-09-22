/**
 * Fixed identity and time for the preview fixtures.
 *
 * Every primary key is derived here, never minted by `gen_random_uuid()`, and
 * every timestamp comes from `atMinute()`, never from the clock — that is what
 * makes two seed runs produce identical table contents (issue #120). The two
 * leading characters of an id name its group, so an id spotted in a failure
 * message or a query traces straight back to the dataset.
 */
export const ID_GROUPS = {
  account: "a1",
  division: "d1",
  user: "d2",
  client: "d3",
  clientTruckCompany: "d4",
  driver: "d5",
  truck: "d6",
  location: "d7",
  route: "d8",
  routeLocation: "d9",
  order: "da",
  trip: "db",
  dailyTruckingPlan: "dc",
  dailyTruckingActual: "dd",
  invoice: "de",
  invoiceShipment: "df",
  invoiceVendor: "e1",
  invoiceComment: "e2",
  truckingApproval: "e3",
  item: "e4",
  quotation: "e5",
  procurementRequest: "e6",
  stockRequisition: "e7",
  stockAlert: "e8",
  warehouseApproval: "e9",
  budget: "ea",
  expenseRequest: "eb",
  nicheDetail: "ec",
  emergencyDetail: "ed",
  expenseApproval: "ee"
} as const;

export type IdGroup = (typeof ID_GROUPS)[keyof typeof ID_GROUPS];

/** The `index`-th id of `group` — stable across runs, and unique within a table. */
export function fixtureId(group: IdGroup, index: number): string {
  return `${group.padEnd(8, "0")}-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

/** 2026-01-05T01:00:00Z — a fixed epoch the fixtures count minutes from. */
const EPOCH = Date.UTC(2026, 0, 5, 1, 0, 0);

/** A fixed timestamp `minutes` after the fixtures' epoch. */
export function atMinute(minutes: number): string {
  return new Date(EPOCH + minutes * 60_000).toISOString();
}

/** `created_at`/`updated_at` for a row, stable across runs and ordered by index. */
export function stamps(index: number) {
  const time = atMinute(index * 10);
  return { created_at: time, updated_at: time };
}

/** The same, plus a soft-delete column — `null` unless a row is meant to be deleted. */
export function softStamps(index: number, deletedAt: string | null = null) {
  return { ...stamps(index), deleted_at: deletedAt };
}
