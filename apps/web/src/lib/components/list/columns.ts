/**
 * The list column rule (ADR-0050): a page states which kind each column is, and
 * the kit decides its width.
 *
 * - `utility`: codes, status, dates and actions. They shrink to their content.
 * - `identity`: the column that names the row. It shares the remaining width.
 * - `text`: free text such as a description. It shares the remaining width too,
 *   and its cell wraps the value in `TEXT_CAP`, with the full text in `title`.
 */
export type ColumnKind = "utility" | "identity" | "text";

const COLUMN_CLASS: Record<ColumnKind, string> = {
  utility: "w-px whitespace-nowrap",
  identity: "",
  text: ""
};

/** Classes for a column's `th` and `td`. */
export const columnClass = (kind: ColumnKind): string => COLUMN_CLASS[kind];

/**
 * For the element inside a `text` cell. A cell ignores `max-width` in an
 * auto-layout table, so the cap sits on a block inside it.
 */
export const TEXT_CAP = "block max-w-[48ch] truncate";
