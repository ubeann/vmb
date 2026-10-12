// PROTOTYPE (prototype/divisions): round 5's switch for the sheet and dialog title's icon, set
// by the prototype page from `?variant=` so the toolbar's layers needn't pass it down.
// `none` is today's. Throwaway; never merge.
// Round 6's `backdrop`: what sits behind the sheet and dialog (`today` is shadcn's 10% black
// and a 4px blur).
export const layerPrototype = $state<{
  titleIcon: "none" | "plain" | "tile";
  backdrop: "today" | "scrim" | "glass" | "tint" | "black";
}>({
  titleIcon: "none",
  backdrop: "today"
});
