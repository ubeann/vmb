export type Fixture = {
  /** Short name used in test titles. */
  name: string;
  /** File under test/fixtures, loaded as plain SQL. */
  file: string;
  /** What this fixture is for, so the next one is easy to place. */
  purpose: string;
};

/**
 * Fixtures are additive: add a file and an entry here, and the harness picks it
 * up. Nothing else changes.
 */
export const fixtures: Fixture[] = [
  {
    name: "minimal",
    file: "minimal.sql",
    purpose: "one valid row per core entity across master, trucking and warehouse"
  },
  {
    name: "edge-cases",
    file: "edge-cases.sql",
    purpose: "data the legacy schema permits but the domain does not"
  }
];
