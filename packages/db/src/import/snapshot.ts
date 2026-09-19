import { readFile } from "node:fs/promises";

/**
 * A legacy `pg_dump --data-only` snapshot: for each table, the column list from
 * its `COPY` header and the rows that followed it.
 *
 * `COPY … FROM stdin` is the format the deployed database produces and the only
 * one the loader needs to understand; anything else in the file is ignored.
 * Null is a real `null`, not a marker string, so a value that looks like the
 * marker cannot be mistaken for one.
 */
export type SnapshotRow = (string | null)[];

export type Snapshot = {
  columns: Map<string, string[]>;
  rows: Map<string, SnapshotRow[]>;
};

const COPY_HEADER = /^COPY\s+([\w.]+)\s*\(([^)]*)\)\s+FROM stdin;$/;

export async function readSnapshot(file: string): Promise<Snapshot> {
  return parseSnapshot(await readFile(file, "utf8"));
}

export function parseSnapshot(text: string): Snapshot {
  const columns = new Map<string, string[]>();
  const rows = new Map<string, SnapshotRow[]>();
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const header = COPY_HEADER.exec(lines[i] ?? "");
    if (!header) continue;

    const table = header[1] as string;
    columns.set(
      table,
      (header[2] as string).split(",").map((name) => name.trim())
    );

    const tableRows: SnapshotRow[] = [];
    for (i++; i < lines.length; i++) {
      const line = lines[i] as string;
      if (line === "\\.") break;
      tableRows.push(line.split("\t").map(decodeCopyValue));
    }
    rows.set(table, tableRows);
  }

  return { columns, rows };
}

/**
 * Undo pg_dump's COPY escaping: tab-delimited, `\N` for null, and a backslash
 * escaping `b`, `f`, `n`, `r`, `t`, `v`, or itself. An escaped backslash is an
 * ordinary character, so a literal `\N` decodes to the two characters and only
 * the unescaped marker becomes null.
 */
function decodeCopyValue(value: string): string | null {
  if (value === "\\N") return null;
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const char = value[i] as string;
    if (char !== "\\") {
      out += char;
      continue;
    }
    const next = value[++i] as string;
    switch (next) {
      case "b":
        out += "\b";
        break;
      case "f":
        out += "\f";
        break;
      case "n":
        out += "\n";
        break;
      case "r":
        out += "\r";
        break;
      case "t":
        out += "\t";
        break;
      case "v":
        out += "\v";
        break;
      default:
        out += next;
    }
  }
  return out;
}
