// A confirmation's layout (#302), shared by every dialog that asks before an
// act: the halo, the title and the description centred, then the safe answer
// and the act side by side, as wide as each other.

/** The dialog's content: centred, the layer's corners, no ×; Esc and the safe answer leave. */
export const CONFIRM_CONTENT =
  "flex flex-col items-center gap-4 rounded-2xl p-6 pt-7 text-center shadow-lg sm:max-w-sm";

/** The title and description under the halo. */
export const CONFIRM_TEXT = "flex flex-col gap-1.5";
export const CONFIRM_TITLE = "text-base leading-tight font-semibold";
export const CONFIRM_DESCRIPTION = "text-muted-foreground text-sm text-balance";

/** The safe answer, then the act: two equal halves of the row. */
export const CONFIRM_ACTIONS = "grid w-full grid-cols-2 gap-2 pt-1 [&_[data-slot=button]]:w-full";
