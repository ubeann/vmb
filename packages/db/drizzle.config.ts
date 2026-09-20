import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema",
  // The chain lives at the repository root, outside every workspace package,
  // so a migration does not invalidate the cache of every package that depends
  // on this one (issue #137). drizzle-kit resolves `out` against its working
  // directory, and the pnpm scripts that run it pin that to the package
  // directory; `test/migrations-path.test.ts` fails if this drifts from
  // `src/migrations-path.ts`.
  out: "../../migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
});
