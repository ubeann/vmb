/**
 * The list column rule (ADR-0050): a page states which kind each column is, and
 * the kit decides its width. The rule reads the card's width through container
 * queries (`@container/list`, set by `ListCard`), as ADR-0051 rule 11 says.
 *
 * - `utility`: actions and anything else that stays. They shrink to their content.
 * - `meta`: codes, dates and the like. They shrink to their content, and under
 *   32rem of card they fold into the identity's second line (`META_LINE`).
 * - `identity`: the column that names the row. It shares the remaining width,
 *   and takes all of it once the rows fold to two lines.
 * - `text`: free text such as a description. It takes the spare width and
 *   truncates down to about 16ch, its cell wrapping the value in
 *   `TEXT_TRUNCATE` with the full text in `title`. Under 42rem of card it folds
 *   and rides under the identity (`TEXT_LINE`).
 */
export type ColumnKind = "utility" | "meta" | "identity" | "text";

const COLUMN_CLASS: Record<ColumnKind, string> = {
  utility: "w-px whitespace-nowrap",
  meta: "w-px whitespace-nowrap @max-lg/list:hidden",
  // max-w-0 stops the name's own width from widening the table; the card is what it shares
  identity: "@max-lg/list:w-full @max-lg/list:max-w-0",
  text: "w-full max-w-0 min-w-[16ch] @max-2xl/list:hidden"
};

/** Classes for a column's `th` and `td`. */
export const columnClass = (kind: ColumnKind): string => COLUMN_CLASS[kind];

/**
 * For the element inside a `text` cell. A cell ignores a width in an
 * auto-layout table, so the clipping sits on a block inside it.
 */
export const TEXT_TRUNCATE = "block truncate";
