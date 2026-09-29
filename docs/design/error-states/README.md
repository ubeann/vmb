# Error states — design round

The error page (`apps/web/src/routes/+error.svelte`) redesigned in the etched territory of the auth pages. This is the second screen through the [design workflow](../../agents/design-workflow.md); the first, and the reference for each step, is [etched login](../etched-login/README.md).

## Brief

- **Who lands here:** anyone who follows a stale link, opens a page their account can't see, or hits a server failure. They need to know which of the three it is and how to get back.
- **Brand idea:** the same engraved record as the login plate. Each failure is a small scene from VMB's own world, told gently: a truck at a signpost that points nowhere, a locked yard gate, a stack of crates that has toppled on the loading dock. There are no mascots, no jokes at the visitor's expense and no "Oops!".
- **Palette and type:** unchanged: navy and green on warm paper (ADR-0036), Newsreader headings, Inter for the rest. The art is an ink mask filled with `--etching`, so no new tokens.
- **Rejected direction:** the flat, multicolour cartoon style of the Getillustrations reference. It would read as a different product, and a new colour style needs an ADR.

## Composition

| Viewport          | Layout                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop (≥ 64rem) | The signed-out masthead and footer strip (`SiteHeader`, `SiteFooter`, shared with `AuthShell`); the copy on the left, the vignette on the right, 4rem apart, both centred vertically. |
| Tablet, mobile    | The vignette above the copy (at most 15rem tall, 11rem below 40rem), 2.5rem clear of the eyebrow. The page fits at 390 × 844 without scrolling.                                       |

The vignette box takes the art's own ratio and is never taller than `--vignette-max-height` (26rem on desktop), so the wide gate and the tall crates take the same room.

## Scenes and copy

The scene follows the status, never chance: the server and the browser draw the same picture, a refresh doesn't swap it, and tests and screenshots stay stable. `errorPageContent(status)` in `apps/web/src/lib/error-page.ts` holds the mapping.

| Status    | Scene          | Heading                | Actions                      |
| --------- | -------------- | ---------------------- | ---------------------------- |
| 404, 410  | Road, signpost | Page not found         | Go to login / Back to VMB    |
| 401, 403  | Locked gate    | No access to this page | Go to login / Back to VMB    |
| 5xx       | Toppled crates | Something went wrong   | Try again, then the way back |
| Other 4xx | Toppled crates | Something went wrong   | The way back                 |

"Try again" reloads the same URL (`data-sveltekit-reload`). An unexpected server failure also gets a short reference from `handleError` in `hooks.server.ts`: it is logged with the error, and the page asks the visitor to email it to `support@vmblogistics.id` (the link pre-fills the subject). A 404 gets no reference and no log line.

## Storyboard

| State          | Behaviour                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Arrival        | The copy and actions are ready at once. The vignette draws in once, left to right, like the login plate (1.6 s, after 150 ms).                                           |
| Reduced motion | The vignette is shown finished.                                                                                                                                          |
| Dark           | The same masks filled with the dark `--etching`: the scene reads as a blueprint. Dense ink (the crates' doorway) turns into a pale block, as the landscape's shadows do. |

## Recraft round (29 Sep, 12 credits)

`recraftv4_1`, 4:3, two images per prompt, 2 credits each. The balance went 985 → 973. No crisp upscale: the vignettes draw at most about 30rem wide, so the 1216px sources are enough.

| Scene  | Pick  | Why                                                                                                                                        |
| ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Road   | **1** | The fork and the three-way signpost read as "lost" at a glance, and the line work is the lightest. 2 is richer, but its road doesn't fork. |
| Crates | **1** | The leaning stack reads as "toppling". 2 is darker and reads as a shed.                                                                    |
| Gate   | **2** | 1 signs the plate with a scribbled signature near the bottom edge, which reads as text.                                                    |

`sources/candidates-round-1.jpg` shows all six. The shared prompt frame, with the scene sentence swapped in:

> Delicate 19th-century steel engraving vignette, fine cross-hatching and stipple, thin black ink lines on plain white paper, monochrome. _\<scene\>_ The scene sits in the middle of the image as a free-standing vignette whose edges dissolve into blank white paper on every side; nothing touches the edges. Light and airy, sparse line work with open white areas, calm and gently wry, museum-quality engraving. No text, lettering, numbers, logos, signatures, borders, frames, people or dense dark areas.

- **Road:** A quiet tropical Indonesian country road that forks in two; a single container truck carrying one shipping container is stopped just before the fork, beside a weathered wooden signpost whose blank, unlettered arrow boards point in different directions. A few palm trees and distant volcanic hills behind.
- **Crates:** On the loading dock of a long pitched-roof timber warehouse, a tall stack of wooden crates has toppled over: several crates tumbled onto the ground at odd angles, one lid knocked open with packing straw spilling out, a hand pallet jack standing beside them, the warehouse corner and its open loading door behind.
- **Gate:** The closed entrance of a container yard: a tall wrought-iron double gate between two stone pillars, shut with a chain and a padlock, a low fence running off to each side; beyond it, stacked shipping containers and one gantry crane stand in the distance.

## Asset pipeline

```sh
python3 docs/design/etched-login/prepare-etching.py docs/design/error-states/sources/road-1-1216.jpg apps/web/src/lib/assets/errors --name vmb-error-road --trim --trim-x
# the same for crates-1 (vmb-error-crates) and gate-2 (vmb-error-gate)
```

The script writes 2400px and 1200px files, which upscale these ~840px masks, so only one size ships: the 1200px output, resized to 840px wide and re-encoded with `cwebp -q 60 -alpha_q 50` (the script's settings). Road 840 × 666 (60 KB), crates 840 × 959 (107 KB), gate 840 × 398 (62 KB). A page loads only its own scene's mask. `error-page.test.ts` fails when a ratio in `ERROR_SCENES` no longer matches its file.

## Checked

- `design-screenshots.mjs` at every review viewport, light and dark, for 404, 403 and 500 (the last two through a local route that threw them, not committed): every capture fits without scrolling. Opened by eye: 1440 × 900 for all three in both schemes, 1366 × 768 (403, light), 1024 × 923 (403, dark), 390 × 844 (404 dark, 500 light). `sources/review-1440x900.jpg` and `sources/review-390x844.jpg` are the sheets.
- Clear zone: the art never sits under text; the gap is 4rem on desktop and 2.5rem stacked. The text colours are the existing tokens, measured in the login round (`--muted-foreground` 5.99:1 light, 8.45:1 dark).
- `AuthShell` after the header and footer moved into `SiteHeader` and `SiteFooter`: `/login` is pixel-identical to before at 1440 × 900, 1024 × 923 and 390 × 844 (reduced motion).
- `pnpm typecheck`, `pnpm lint` and `pnpm test` in `apps/web`.

## Not yet checked

- Owner review in a real browser (step 7).
- A real 500 on Cloudflare Pages, and that its reference shows up in the Pages logs.
- Screen readers, 200% zoom.
