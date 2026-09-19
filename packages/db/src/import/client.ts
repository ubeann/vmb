import type { PGlite } from "@electric-sql/pglite";

/**
 * The pipeline's view of a database.
 *
 * Small on purpose: it is all the pipeline needs, and it lets the same code run
 * against embedded Postgres in tests and against a Neon branch in the field.
 */
export type SqlClient = {
  /** Run one or more statements, discarding any rows. */
  exec(sql: string): Promise<void>;
  /** Run one statement and return its rows. */
  query<T>(sql: string): Promise<T[]>;
};

export function pgliteClient(client: PGlite): SqlClient {
  return {
    exec: async (sql) => {
      await client.exec(sql);
    },
    query: async <T>(sql: string) => (await client.query<T>(sql)).rows
  };
}

type PgLike = {
  query(sql: string): Promise<{ rows: unknown[] }>;
};

/** An adapter for `pg`'s client or pool, so the CLI can reach a real Postgres. */
export function pgClient(client: PgLike): SqlClient {
  return {
    exec: async (sql) => {
      await client.query(sql);
    },
    query: async <T>(sql: string) => (await client.query(sql)).rows as T[]
  };
}
