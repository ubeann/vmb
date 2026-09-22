import { account, masterTables, user } from "./data/master.js";
import { expenseTables } from "./data/expense.js";
import { truckingTables } from "./data/trucking.js";
import { warehouseTables } from "./data/warehouse.js";
import type { SeedTable } from "./sql.js";

/**
 * The schemas the seed owns. `drizzle` is deliberately absent: the migration
 * journal lives there and must survive a seed, so a later `db:migrate` knows
 * what is already applied (issue #120). `public` is here because Better Auth's
 * tables live in it, not because it holds anything else.
 */
export const WIPE_SCHEMAS = ["public", "master", "trucking", "warehouse", "expense"] as const;

/**
 * Every seeded table, parents before children so each `insert` satisfies its
 * foreign keys. Unlike the import pipeline's `schemaOrder`, this order is
 * hand-kept — the graph is shallow and the dataset is static — and a wrong
 * edge fails loudly in `seed.test.ts` rather than loading silently broken.
 */
export const seedTables: SeedTable[] = [
  user,
  account,
  ...masterTables,
  ...truckingTables,
  ...warehouseTables,
  ...expenseTables
];
