import { eq, lt, lte, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { rateLimit, type DatabaseSchema } from "./schema/index.js";

export const CODE_REQUEST_LIMIT = { window: 3600, max: 5 } as const;

/** Consume before looking up the User. The caller supplies an opaque, keyed hash. */
export async function consumeCodeRequest(
  db: PgDatabase<PgQueryResultHKT, DatabaseSchema>,
  key: string
): Promise<{ allowed: boolean; retryAfter: number | null }> {
  const now = Date.now();
  const cutoff = now - CODE_REQUEST_LIMIT.window * 1000;
  // A conditional upsert serializes both first requests and increments across
  // isolates. Like Better Auth's IP counters, reset after a full idle window;
  // rejected requests neither increment the count nor extend that window.
  const rows = await db
    .insert(rateLimit)
    .values({ id: crypto.randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${rateLimit.lastRequest} <= ${cutoff} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`greatest(${rateLimit.lastRequest}, ${now})`
      },
      setWhere: or(lte(rateLimit.lastRequest, cutoff), lt(rateLimit.count, CODE_REQUEST_LIMIT.max))
    })
    .returning({ count: rateLimit.count });

  if (rows.length) return { allowed: true, retryAfter: null };

  const [row] = await db
    .select({ lastRequest: rateLimit.lastRequest })
    .from(rateLimit)
    .where(eq(rateLimit.key, key));
  return {
    allowed: false,
    retryAfter: row
      ? Math.max(1, Math.ceil((row.lastRequest + CODE_REQUEST_LIMIT.window * 1000 - now) / 1000))
      : CODE_REQUEST_LIMIT.window
  };
}
