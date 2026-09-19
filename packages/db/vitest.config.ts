import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The harness boots a WASM Postgres and replays the migration chain. That
    // is fast locally and slower on a CI runner, so neither the tests nor the
    // hooks that boot the database get the 5s default.
    testTimeout: 30_000,
    hookTimeout: 30_000
  }
});
