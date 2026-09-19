import { portedTables } from "./manifest.js";
import type { Snapshot } from "./snapshot.js";
import type { Finding } from "./verify.js";

export type LoadPlan = {
  statements: string[];
  problems: Finding[];
};

/**
 * Statements that insert a snapshot into the baseline.
 *
 * Every value is emitted as a SQL literal, because `COPY FROM stdin` is not
 * available on every target the pipeline runs against. `\N` is the null marker
 * the parser produces for pg_dump's unquoted null.
 */
export function loadStatements(snapshot: Snapshot): LoadPlan {
  const statements: string[] = [];
  const problems: Finding[] = [];

  for (const table of portedTables) {
    const rows = snapshot.rows.get(table);
    if (!rows?.length) continue;

    const names = snapshot.columns.get(table);
    if (!names?.length) {
      problems.push({
        level: "error",
        code: "no-columns",
        message: `${table}: the snapshot has rows but no column list`
      });
      continue;
    }
    const columns = names.map(quoteIdentifier);

    rows.forEach((row, index) => {
      if (row.length !== columns.length) {
        problems.push({
          level: "error",
          code: "row-shape",
          message: `${table}: row ${index + 1} has ${row.length} values for ${columns.length} columns`
        });
        return;
      }
      const values = row.map((value) => (value === "\\N" ? "NULL" : quoteLiteral(value)));
      statements.push(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${values.join(", ")});`
      );
    });
  }

  return { statements, problems };
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * A SQL string literal. `standard_conforming_strings` is on, so a backslash is
 * an ordinary character: doubling the single quote is the whole job. Control
 * characters are emitted as they are, because escaping them with a backslash
 * would store the backslash instead of the character.
 */
function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
