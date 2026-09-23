import { createDb, createMasterStore, type MasterStore } from "@vmb/db";
import { hashPassword } from "better-auth/crypto";
import type { Bindings } from "./bindings.js";

// Cached per Worker isolate, like `createAuth`: the bindings are constant for
// the isolate's lifetime and building the store walks the whole schema, which
// is not work to repeat on every request within the free tier's CPU budget.
let cached: MasterStore | undefined;

export function masterStore(env: Bindings): MasterStore {
  cached ??= createMasterStore(createDb(env.DATABASE_URL), { hashPassword });
  return cached;
}
