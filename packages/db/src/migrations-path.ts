import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The migration chain, where `drizzle-kit generate` writes it and every
 * replay reads it.
 *
 * It sits at the repository root, outside every workspace package: a migration
 * is read by this package's tests but by nothing an app builds, so keeping it
 * inside `@vmb/db` invalidated the cache of every package that depends on
 * `@vmb/db` (issue #137). `turbo.json` names the same directory as
 * `$TURBO_ROOT$/migrations/**` for the test task; `drizzle.config.ts` names it
 * for drizzle-kit, whose working directory the pnpm scripts pin to the package
 * directory — `test/migrations-path.test.ts` fails if the two drift.
 */
export const migrationsFolder = path.resolve(here, "../../../migrations");
