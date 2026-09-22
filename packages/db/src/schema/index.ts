import * as auth from "./auth.js";
import * as master from "./master.js";
import * as warehouse from "./warehouse.js";
import * as trucking from "./trucking.js";
import * as expense from "./expense.js";

export * from "./auth.js";
export * as master from "./master.js";
export * as warehouse from "./warehouse.js";
export * as trucking from "./trucking.js";
export * as expense from "./expense.js";

/**
 * Every table as one flat object, which is the shape Drizzle's constructor
 * expects. Spreading per-schema namespaces here (rather than handing Drizzle
 * the module namespace) keeps `createDb` working under native ESM, where a
 * namespace object has a null prototype and Drizzle reads `constructor` off it.
 */
export const schema = { ...auth, ...master, ...warehouse, ...trucking, ...expense };

export type DatabaseSchema = typeof schema;
