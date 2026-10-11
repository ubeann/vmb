import { getContext, setContext } from "svelte";

const KEY = Symbol("list-card");

/** What a list's card knows about its own width, for what can't ask the CSS (a portalled panel). */
export class ListCardState {
  /** Whether rows have folded to two lines (ADR-0051 rule 11). */
  folded = $state(false);
}

export const setListCard = (): ListCardState => setContext(KEY, new ListCardState());

/** The card the caller sits in, or undefined outside one. */
export const useListCard = (): ListCardState | undefined => getContext(KEY);
