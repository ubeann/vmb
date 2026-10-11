/**
 * How a toolbar button folds when its card is under 42rem (ADR-0051 rule 11): it
 * becomes an icon button, its label stays for a screen reader, and the count
 * badge moves to its corner. The card is the `@container/list` ListToolbar sets.
 */
export const TOOL_BUTTON =
  "relative @max-2xl/list:w-8 @max-2xl/list:justify-center @max-2xl/list:px-0!";
export const TOOL_LABEL = "@max-2xl/list:sr-only";
export const TOOL_BADGE =
  "bg-primary text-primary-foreground rounded-full px-1.5 text-xs tabular-nums @max-2xl/list:absolute @max-2xl/list:-top-1.5 @max-2xl/list:-right-1.5 @max-2xl/list:h-4 @max-2xl/list:min-w-4 @max-2xl/list:px-1 @max-2xl/list:text-[0.65rem] @max-2xl/list:leading-4 @max-2xl/list:ring-2 @max-2xl/list:ring-background";
