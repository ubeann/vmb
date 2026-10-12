import { Client, neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzleWebSocket } from "drizzle-orm/neon-serverless";
import type { OpenTransaction } from "./master/db.js";
import { schema } from "./schema/index.js";

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;

/**
 * Transactions over a Neon WebSocket, which the HTTP driver above cannot run
 * (ADR-0049). Each call opens a connection of its own and hands its closing to
 * `waitUntil`, so the reply does not wait on it: a Worker may not reuse an I/O
 * object across requests, so the connection is never kept between calls. The
 * same `DATABASE_URL`; no `ws` package, as Workers has a global `WebSocket`.
 */
export function createTransactionOpener(
  databaseUrl: string,
  waitUntil: (promise: Promise<unknown>) => void
): OpenTransaction {
  return async (work) => {
    const client = new Client(databaseUrl);
    try {
      await client.connect();
      return await drizzleWebSocket(client, { schema }).transaction(work);
    } finally {
      waitUntil(client.end());
    }
  };
}
