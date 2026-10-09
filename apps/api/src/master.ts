import { createDb, createMasterStore, createTransactionOpener, type MasterStore } from "@vmb/db";
import { hashPassword } from "better-auth/crypto";
import { waitUntil } from "cloudflare:workers";
import type { Bindings } from "./bindings.js";

// Cached per Worker isolate, like `createAuth`: the bindings are constant for
// the isolate's lifetime and building the store walks the whole schema, which
// is not work to repeat on every request within the free tier's CPU budget.
// Only the HTTP driver is held here; the transaction opener keeps no
// connection, opening a WebSocket per transaction and closing it after the
// reply (ADR-0049).
let cached: MasterStore | undefined;

export function masterStore(env: Bindings): MasterStore {
  cached ??= createMasterStore(createDb(env.DATABASE_URL), {
    hashPassword,
    transaction: createTransactionOpener(env.DATABASE_URL, waitUntil)
  });
  return cached;
}
