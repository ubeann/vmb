// PROTOTYPE (prototype/list-kit): the seeded Divisions, plus one Inactive and one Trashed, so
// the variants show every state without the API. Throwaway; never merge.
import type { Division } from "@vmb/types";

const SEED: [string, string, string, string, string][] = [
  [
    "Operations",
    "OPS",
    "Fleet, trips and day-to-day operations",
    "#2563EB",
    "heroicon-o-cog-6-tooth"
  ],
  ["Finance", "FIN", "Budgets, invoices and payment settlement", "#16A34A", "heroicon-o-banknotes"],
  [
    "Human Resources",
    "HRD",
    "People, payroll and administration",
    "#DB2777",
    "heroicon-o-user-group"
  ],
  [
    "Information Technology",
    "ITD",
    "Systems, devices and internal support",
    "#7C3AED",
    "heroicon-o-computer-desktop"
  ],
  ["Warehouse", "WHS", "Stock, procurement and requisitions", "#EA580C", "heroicon-o-cube"],
  ["Trucking", "TRK", "Container haulage and route execution", "#0891B2", "heroicon-o-truck"],
  ["Procurement", "PRC", "Vendor selection and purchasing", "#CA8A04", "heroicon-o-shopping-cart"],
  ["Legal", "LGL", "Contracts, permits and compliance", "#4B5563", "heroicon-o-scale"],
  [
    "Health, Safety & Environment",
    "HSE",
    "Workplace safety and environmental controls",
    "#DC2626",
    "heroicon-o-shield-check"
  ],
  [
    "Quality Assurance",
    "QAS",
    "Service quality and audit follow-up",
    "#0D9488",
    "heroicon-o-clipboard-document-check"
  ],
  [
    "Marketing",
    "MKT",
    "Client relations and market development",
    "#9333EA",
    "heroicon-o-megaphone"
  ],
  [
    "General Affairs",
    "GAD",
    "Facilities, vehicles and office support",
    "#64748B",
    "heroicon-o-building-office"
  ],
  [
    "Customs Brokerage",
    "CBK",
    "Import and export clearance, paused while the licence renews",
    "#B45309",
    "heroicon-o-building-office"
  ],
  ["Field Survey", "FSV", "Site surveys before new routes", "#0F766E", "heroicon-o-truck"]
];

const at = (day: number, minute: number) =>
  new Date(Date.UTC(2026, 0, day, 1, minute)).toISOString();

export const DIVISIONS: Division[] = SEED.map(
  ([name, code, description, colorHex, iconName], i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    name,
    code,
    description,
    colorHex,
    iconName,
    isActive: code !== "CBK",
    createdAt: at(-20 + i * 2, i * 3),
    updatedAt: at(5 + (i % 4), 10 + i * 4),
    deletedAt: code === "FSV" ? at(9, 15) : null
  })
);

// Round 45: a long list for paging (`?data=many`): every department in 20 branch cities, about
// 240 live divisions (10 pages of 25), every 9th inactive and every 17th in the Trash
const CITIES: [string, string][] = [
  ["Jakarta", "JKT"],
  ["Surabaya", "SUB"],
  ["Medan", "MDN"],
  ["Bandung", "BDG"],
  ["Semarang", "SRG"],
  ["Makassar", "MKS"],
  ["Palembang", "PLM"],
  ["Balikpapan", "BPN"],
  ["Batam", "BTH"],
  ["Pontianak", "PNK"],
  ["Denpasar", "DPS"],
  ["Yogyakarta", "JOG"],
  ["Manado", "MDO"],
  ["Padang", "PDG"],
  ["Pekanbaru", "PKU"],
  ["Banjarmasin", "BDJ"],
  ["Kupang", "KOE"],
  ["Jayapura", "DJJ"],
  ["Ambon", "AMQ"],
  ["Cirebon", "CBN"]
];

const minuteAt = (minutes: number) =>
  new Date(Date.UTC(2025, 10, 1, 1, 0) + minutes * 60_000).toISOString();

export const MANY_DIVISIONS: Division[] = [
  ...DIVISIONS,
  ...SEED.slice(0, 12).flatMap(([name, code, description, colorHex, iconName], d) =>
    CITIES.map(([city, cityCode], c): Division => {
      const n = d * CITIES.length + c;
      // spread over 1 Nov 2025 – 8 Jan 2026 so the date presets and sorting have something to do
      const created = (n * 389) % (60 * 24 * 60);
      const updated = Math.min(created + ((n * 977) % (8 * 24 * 60)), 68 * 24 * 60);
      return {
        id: `00000000-0000-4000-9000-${String(n + 1).padStart(12, "0")}`,
        name: `${name} · ${city}`,
        code: `${code}-${cityCode}`,
        description: `${description}, ${city} branch`,
        colorHex,
        iconName,
        isActive: n % 9 !== 4,
        createdAt: minuteAt(created),
        updatedAt: minuteAt(updated),
        deletedAt: n % 17 === 8 ? minuteAt(updated + 600) : null
      } as Division;
    })
  )
];
