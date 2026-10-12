// PROTOTYPE (prototype/divisions): round 5's switch for the sheet and dialog title's icon, set
// by the prototype page from `?variant=` so the toolbar's layers needn't pass it down.
// `none` is today's. Throwaway; never merge.
export const layerPrototype = $state<{ titleIcon: "none" | "plain" | "tile" }>({
  titleIcon: "none"
});
