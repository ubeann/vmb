# Activate: an etched mark for the code step — design round

An etched mark for `/activate`'s code step (issue #273, a follow-up to #254 and #234). This is the fourth screen through the [design workflow](../../agents/design-workflow.md), after [etched login](../etched-login/README.md), [error states](../error-states/README.md) and [etched scenes](../etched-scenes/README.md).

## Brief

- **Who sees it:** a migrated user, or anyone who forgot their password, who has just asked for a one-time code and is waiting on an email. The step is short and quiet; they need to find the six boxes.
- **Brand idea:** the same engraved record as the login plate. The art says one thing, "a sealed message was sent to you", in VMB's own register: paper, wax and a service bell, like the crates, gates and trucks, not a generic icon. No mascots, no text in the art.
- **Why art and not a Lucide icon:** #234 tried a heading icon and dropped it: a 1.75px stroke next to Newsreader reads as a stray glyph and repeats the field's own lock. Its README allowed a revisit "only with a bespoke etched-weight mark". This round is that revisit. #234 also keeps icons out of the six code boxes, so neither mark goes near them.
- **Palette and type:** unchanged. The art is an ink mask filled with `--etching`, so there is no new token and no ADR.

## Directions

The owner chose the motif (sealed envelope with a wax seal) and asked for both placements from the issue to be built and compared.

| Direction                            | What it is                                                                                                                             | Why it might win                                                            | Why it might not                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **A. Seal at the card's corner**     | A small tilted envelope with a wax seal, straddling the card's top-right corner, 5.75rem wide. At `lg` and wider.                      | It sits on the card, so it is the closest to the step. Reads like a stamp.  | It hides in the card's ring and the sky at its edge. It is small; there is no room for more inside. |
| **B. Post vignette beside the card** | Sealed letters on a crate with a service bell, 14rem wide, in the gap left of the card, level with the code boxes. At 80rem and wider. | A real scene in the landscape's own language; the extra layer of the plate. | Far from the boxes, and absent below 80rem, so most laptops at 125% zoom won't see it.              |

An in-card mark beside or above "Enter your code" was ruled out on measurement: the line beside the h1 has about 100px of room after the 2.5rem clear zone, and the description sits right under it, so only a mark that straddles the card's top edge keeps the zone (A).

## Both ship as candidates

Both are built on the real route and shown on the code step only, so the owner can compare them in their own browser and keep one, both or neither. Removing a direction is deleting one `<EtchedMark>` in `+page.svelte`.

| Place    | Where                                     | Size             | Shown          | Clear zone (measured)                                       |
| -------- | ----------------------------------------- | ---------------- | -------------- | ----------------------------------------------------------- |
| Seal (A) | `-top-[2.3rem] right-8` of the card's box | 5.75rem × 4.6rem | ≥ 64rem (`lg`) | 41px to the nearest text, header included (≥ 2.5rem = 40px) |
| Post (B) | `top-64`, 2.5rem left of the card         | 14rem × 7.2rem   | ≥ 80rem        | 72px to text, 73px to a control                             |

Both are `aria-hidden`, absolutely placed, so they never change the card's height, and they are not drawn on the email or password step. Below `lg` (390px included) neither shows: the h1 leaves no room beside it, and a mark above the card would collide with the headline. Neither moves. The plates draw in once, but these two mount on every entry to the code step, and the first code box takes focus at that moment: design-workflow.md's rule is that nothing moves near a focused field, so they appear with the step, which the sheet's own view transition already cross-fades. (The first build drew them in like the plates; the code review caught the conflict.)

## Recraft round (4 Oct, 8 credits)

`recraftv4_1`, two images per prompt, 2 credits each: 946 → 938. No crisp upscale: the seal is shown at 96 CSS px and the vignette at 224, so the 1024px and 1216px sources are enough. The shared frame is the error round's, with the scene sentence swapped.

| Art      | Size | Pick  | Why                                                                                                                                                                |
| -------- | ---- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Seal     | 1:1  | **2** | Clean outline, a little hatching on the flap and a legible seal. 1 shades the edges with scribbled hatching that turns to noise at 96px.                           |
| Vignette | 4:3  | **2** | Three sealed letters leaning on an open crate, the bell beside it, open paper all around. 1 is cleaner, but the bell dominates and the letters are small at 14rem. |

Prompts:

> Seal: Delicate 19th-century steel engraving of a single small sealed envelope with a round wax seal on its flap, seen straight on, slightly tilted, fine cross-hatching shading on the flap and seal, thin black ink lines on plain white paper, monochrome. The envelope sits alone in the middle of the image as a free-standing emblem whose edges dissolve into blank white paper on every side; nothing touches the edges. Light, airy, sparse line work with open white areas, calm, museum-quality engraving. No text, lettering, numbers, logos, signatures, borders, frames, people or dense dark areas.

> Vignette: the error round's frame with the scene: _A few sealed letters with wax seals resting on a wooden crate beside a small brass post-office bell, one letter leaning against the crate, seen from slightly above._

Both picks and the two they were chosen over are in `sources/` (`seal-*`, `vignette-*`; the first vignette is only the 608px preview).

## Asset pipeline

```sh
python3 docs/design/etched-login/prepare-etching.py docs/design/activate-mark/sources/seal-2-1024.jpg apps/web/src/lib/assets/activate \
  --name vmb-activate-seal --trim --trim-x --widths 192 --white 235 --black 150
python3 docs/design/etched-login/prepare-etching.py docs/design/activate-mark/sources/vignette-2-1216.jpg apps/web/src/lib/assets/activate \
  --name vmb-activate-post --trim --trim-x --widths 640
```

| Mask                    | Size                              | Ratio | Weight   |
| ----------------------- | --------------------------------- | ----- | -------- |
| `vmb-activate-seal-192` | 671 × 535 ink, written 192px wide | 1.254 | 2.8 KiB  |
| `vmb-activate-post-640` | 800 × 413 ink, written 640px wide | 1.937 | 24.7 KiB |

The seal's hairline outline vanished at the default thresholds when 671px of ink is scaled to 96px, so it takes `--white 235 --black 150` to thicken it, and a 192px mask (2× its CSS size) instead of 160. The vignette's engraving is heavier and needs no change. `activate-art.test.ts` fails when a ratio in `ACTIVATE_ART` no longer matches its file.

## Verification

Chromium, dev build, the code step (reached with the `vmb_activate_sent` cookie the real action sets), all six review viewports, light and dark. Playwright's `fullPage` capture resizes the viewport on a page that scrolls (1366 × 768 and 390 × 844), and the art, the sky included, then comes out missing; use a viewport capture there. Two captures are kept in `captures/`.

- **Clear zone:** distance from each mark to the nearest text line in `main` and to the nearest input or button, measured with `getClientRects` on every text node. Re-measured after review over every text node on the page, header included: seal 41.4px, post 72.2px (and 73px to a control), at 1920, 1680, 1440, 1366, 1300 and 1280 (the narrowest width the post shows at). The seal is 5.75rem because the window between the header's tagline and the description is 157px, which a 6rem seal could not keep 2.5rem clear of on both sides (39px to the header). Nothing is under a mark.
- **Layout shift:** with and without the art (`display: none`) the card is the same height at every viewport (673px, 697px at 390 × 844) and so is the page (1080, 1000, 900, 897, 923, 1104px). The password-manager probe from step 6 (a zero-height in-flow element and a 24px absolutely placed badge after each input) left every mark, the card height and every input at the same rectangles at all eight widths.
- **Contrast:** not measured: the art carries no text and no text sits over it (every text line is at least 2.5rem clear, above), so the text pairs are the ones in [auth field icons](../auth-field-icons/README.md). The ink is `--etching` in both schemes.
- **Overlaps with the plate:** at 1440 × 900 the post's box ends about 33px above the crane tips and starts about 40px right of the flock, read off the capture, not measured. Both are art, not text, so the 2.5rem rule does not apply.
- **Where it shows:** 1920, 1680, 1440 and 1366: both. 1024: the seal only. 390: neither.

## Deviations from the workflow

- **No separate stand-in.** Step 3 asks for stand-in art on the real route first. The owner had approved Recraft and its credits, and 8 credits were cheaper than a throwaway Pen round, so the first generated art went straight onto the route. Both placements were then judged on the real page.
- **Chromium only.** Firefox and WebKit were not rendered (`--browser firefox|webkit` in `design-screenshots.mjs`).
- **The seal is a hybrid.** The issue's in-card spot (beside or above the heading) fails the clear zone, so the seal straddles the card's top edge. It sits in the card's DOM and so inside the `auth-card` view-transition element; whether its overhang survives the email-to-code morph in a real browser was not checked.
- **Two directions, not three.** The owner asked for the issue's two placements, so there are two.

## Owner review

To do, in the owner's own browser at native size, with their extensions installed:

- [ ] Which direction to keep: the seal (A), the post vignette (B), both, or neither. If neither is kept, this README records why, as #234 did for the heading icon.
- [ ] The seal over the card's border ring: a hairline of the ring shows through the envelope. If that reads as a flaw, the seal gets a paper backing.
- [ ] 1Password / Bitwarden badges: no overlap with the boxes, no shift. Neither mark is near a field.
- [ ] Light and dark, at the screen's own size: the post vignette clear of the flock and the plate.
