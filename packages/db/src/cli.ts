/**
 * The bits of argument and duration handling the `db:*` entrypoints share
 * (`migration/cli.ts`, `import/cli.ts`, `seed/cli.ts`).
 *
 * One definition, so the three commands cannot drift in how they read a flag
 * or print a timing — the same reason `preview.yml` and `cleanup.yml` share
 * `scripts/preview-identifiers.sh`.
 */
export function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** A duration as `123ms` or `1.2s`. */
export function duration(milliseconds: number): string {
  return milliseconds < 1000 ? `${milliseconds}ms` : `${(milliseconds / 1000).toFixed(1)}s`;
}
