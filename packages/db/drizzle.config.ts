import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema",
  // The chain lives at the repository root, outside every workspace package,
  // so a migration does not invalidate the cache of every package that depends
  // on this one (issue #137). This path is relative to the package directory
  // drizzle-kit runs in.
  out: "../../migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
});
