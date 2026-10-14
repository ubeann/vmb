# List kit round 2 parity sheet

The owner's second round of adjustments to the list kit, on the Divisions list (2026-10-13). The prototype is evidence; this sheet and the ADR amendments are the spec (`docs/agents/ui-prototype-round.md`): ADR-0050, ADR-0051, ADR-0053 and ADR-0036, each amended 2026-10-13. A ticket quotes a row, never "match P".

**Read the prototype** at the pinned commit; its line numbers below are for each file as it stands there:

```sh
git show e21f8c9:apps/web/src/lib/components/AppShell.svelte               # Shell rows
git show e21f8c9:apps/web/src/lib/components/list/ListFooter.svelte        # Count line
git show e21f8c9:apps/web/src/lib/components/list/ViewPanel.svelte         # Reset, View's icon
git show e21f8c9:apps/web/src/lib/components/list/FilterPanel.svelte       # Filter's icon
git show e21f8c9:apps/web/src/lib/components/list/layer/Layer.svelte       # Title icon, backdrop
git show e21f8c9:apps/web/src/routes/prototype/divisions/+page.svelte      # the variants and what each turns on
```

To run it, check out the branch and run `pnpm --filter @vmb/web prototype`, then open `/prototype/divisions?variant=P` (dev only, on fixtures, no sign-in). `P` is the final variant and carries every pick; the switcher at the bottom walks A to P. The branch is `prototype/list-kit-round-2`; it never merges. The prototype reaches the shared components through throwaway props (`footerAt`, `crumbs`, `wholeCount`, `resetAt`, a `layerPrototype` store), so a row quotes the value its pick turns on, not the prop.

**Round** is the order the owner took the adjustments in, and the variant that won; the commit that records each pick says "Owner pick". **Master** is the parity audit's finding (#436), audited at `86ddefb`: `match`, `fixed in #<n>` or `deviation Dn` (see Deviations).

## Shell

| Component                           | Value                                                                                                                                                                                              | Prototype                                      | Round | ADR rule                          | Master       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----- | --------------------------------- | ------------ |
| What scrolls                        | The window, at every width. The column under the bar is `flex min-w-0 flex-1 flex-col min-h-svh` (was `md:h-svh`); the panel drops `md:min-h-0 md:overflow-y-auto`. The bar keeps `sticky top-0`.  | AppShell 167–171, 217–220                      | 1 (C) | ADR-0050 2026-10-13, footer strip | match        |
| Footer strip                        | `SiteFooter` after the panel, outside `main`, classes unchanged (`max-w-none px-4 pt-2 pb-3 sm:px-3 sm:pl-2 lg:px-3 lg:pl-2`): at the window's foot on a short page, after the panel on a long one | AppShell 242                                   | 1 (C) | ADR-0050 2026-10-13, footer strip | match        |
| Bounce past either end              | The root's background is the frame's, `var(--sidebar)`, in both themes, while the shell is on the page                                                                                             | AppShell 249–256                               | 1 (C) | ADR-0050 2026-10-13, footer strip | match        |
| Scroll on back, forward, a new page | The snapshot kept for back and forward, and the jump to the top on a new page, read and set the window's scroll                                                                                    | none: SvelteKit's own window handling stood in | 1 (C) | ADR-0050 2026-10-13, footer strip | deviation D1 |
| The bar below `md`                  | `SidebarToggle`, then `ProfileMenu` at `ml-auto`. The trail sits in `min-w-0 max-md:hidden`; no logo, no back link                                                                                 | AppShell 177–181, 190                          | 3 (H) | ADR-0050 rule 5, 2026-10-13       | match        |

## List footer

| Component  | Value                                                                                                                                                                                                                                                                                                                        | Prototype        | Round | ADR rule                          | Master |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----- | --------------------------------- | ------ |
| Count line | With no search or filter (`outOf` null), rows (`total > 0`) and one page: `${total} ${nounFor(noun, total)}`, "13 divisions", "1 deleted division". Every other case as today: "n of m divisions", "Showing 1–25 of 239", "No divisions". The rule belongs in `countSummary` (`$lib/master/list.ts`), so every list takes it | ListFooter 51–55 | 2 (D) | ADR-0051 2026-10-13 (rules 9, 10) | match  |

## Layer (sheet and dialog)

| Component    | Value                                                                                                                                                                                                                                                                                                             | Prototype                                     | Round | ADR rule                                           | Master |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----- | -------------------------------------------------- | ------ |
| View's Reset | In the sheet and dialog: `<Button variant="ghost" class="in-data-[layer-frame=modal]:h-11">Reset</Button>` before Done in the footer, while something differs (as Filter's, FilterPanel 289–297). By the title it is `in-data-[layer-frame=modal]:hidden`, so the panel keeps its quiet link                      | ViewPanel 150, 273–282                        | 4 (I) | ADR-0053 rule 4, 2026-10-13                        | match  |
| Title's icon | Sheet and dialog, top level only: the trigger's icon before the title, `<Icon aria-hidden="true" class="text-muted-foreground mr-1.5 size-5 shrink-0" />`. Filter's is `ListFilterIcon`, View's `Settings2Icon`. A step's header and the panel have none. In the build it is a `Layer` prop (`icon`), not a store | Layer 446–457; FilterPanel 183; ViewPanel 133 | 5 (K) | ADR-0053 2026-10-13, title's icon                  | match  |
| Backdrop     | `--scrim`: `oklch(0 0 0 / 0.4)` in light mode, `oklch(0.2 0.08 268 / 0.45)` in dark; no backdrop blur. It replaces the registry overlay's own classes (`dialog-overlay.svelte`), so every dialog takes it, the delete confirmation included                                                                       | Layer 383–394 (`black`, 389–390)              | 6 (P) | ADR-0053 2026-10-13, backdrop; ADR-0036 2026-10-13 | match  |

## Deviations

The audit (#436) found every other row matching `master` at `86ddefb`. The five build tickets (#431 to #435, PRs #437, #438, #441, #442, #443) closed the gaps the sheet listed; the owner tuned no value during them, so the Layer table's `--scrim` row is the value ADR-0036 and ADR-0053 record.

| Dn  | Row                                 | What master does instead                                                                                                                                                 | The owner's reason                                                                                                                                                                                               | The PR or ADR that decided it                                                             |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| D1  | Scroll on back, forward, a new page | No snapshot: SvelteKit restores the window's scroll on back, forward and reload. The jump to the top on a new page runs from 48rem only, so a phone is left to SvelteKit | A snapshot that wrote `window.scrollY` back would repeat SvelteKit's own handling, which is what the prototype relied on; below 48rem the old jump never had any effect, since the window already scrolled there | #437 ([owner's decision](https://github.com/ubeann/vmb/pull/437#issuecomment-6140163565)) |

A later deviation goes here as `Dn | Row | What master does instead | The owner's reason | The PR or ADR that decided it`, and its row's Master cell reads `deviation Dn`.

## Tried and dropped

| Variant | What it tried                                              | Why it lost                                                                                                  |
| ------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| B       | The footer at the end of the panel, inside its scroll      | On the white sheet instead of the frame, and inside `main` it lost the contentinfo landmark                  |
| E       | Below `md`, the logo, and "‹ Divisions" on a record's page | The record's page already has its own back link                                                              |
| F       | Below `md`, the logo, and the trail above the page title   | A line above every title on a phone                                                                          |
| G       | Below `md`, the logo alone                                 | The sidebar's sheet already carries it                                                                       |
| J       | "Reset · View · ×", the title centred                      | Reset in the corner hardest to reach, and the two sheets still differ                                        |
| L       | The title's icon on a green tile                           | Green means a filter in use; a tile reads as a record's identity                                             |
| M       | The navy at 45% in light mode too                          | It tinted the warm page blue                                                                                 |
| N       | A frosted glass sheet over a near-clear backdrop           | Varying contrast behind small text, a heavy blur on mid-range phones, and not the etched navy-and-green look |
| O       | The navy at 30% over a 2px blur                            | The blur kept the page's colours competing; the owner chose M, then P                                        |
