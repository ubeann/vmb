# Activate: an etched mark for the code step — design round

An etched mark for `/activate`'s code step (issue #273, a follow-up to #254 and #234). This is the fourth screen through the [design workflow](../../agents/design-workflow.md), after [etched login](../etched-login/README.md), [error states](../error-states/README.md) and [etched scenes](../etched-scenes/README.md).

## Brief

- **Who sees it:** a migrated user, or anyone who forgot their password, who has just asked for a one-time code and is waiting on an email. The step is short; they need to find the six boxes.
- **The problem:** the code step's card was all text: the page heading and intro, the step's own heading and sentence, a link, the boxes, a hint, two buttons, a help paragraph and a way back. Art was the owner's idea for relief, but the page's intro and a second heading were noise too.
- **Brand idea:** the same engraved record as the login plate. The art says "a message with your code is on its way" in VMB's register: paper and ink, not a generic icon. No mascots, no text in the art.
- **Why art and not a Lucide icon:** #234 tried a heading icon and dropped it: a 1.75px stroke next to Newsreader reads as a stray glyph and repeats the field's own lock. Its README allowed a revisit "only with a bespoke etched-weight mark". This round is that revisit. #234 also keeps icons out of the six code boxes, so the art sits above them, not in them.
- **Palette and type:** unchanged. The art is an ink mask filled with `--etching`, so there is no new token and no ADR.

## What ships

On the code step only:

| Part         | Before                                                                                         | After                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Page heading | "Set your password" (all three steps)                                                          | "Enter your code" (the code step's own); the other steps are as before |
| Intro        | "First time here or forgot your password? We will email you a one-time code to set a new one." | Left out: it explains the email step                                   |
| Step heading | "Enter your code" as an `h2` under the page heading                                            | Gone: the page heading says it                                         |
| Art          | none                                                                                           | An etched open envelope with a slip half out, centered above "Code"    |

`ACTIVATE_ART.slip` (`apps/web/src/lib/activate-art.ts`) is drawn by `EtchedMark` (`$lib/components/EtchedMark.svelte`): an ink mask filled with `--etching`, 7rem wide, `aria-hidden`, static. It sits in the code form's flow with the card's own `space-y-5` (1.25rem) above and below. Its box takes the mask's ratio, so the height is known before the mask loads and nothing moves. It shows at every width, 390px included.

The email and password steps are unchanged and draw no art.

## How the direction was reached

1. **Corner seal and post vignette (rejected).** The owner chose the motif (a sealed envelope) and asked for the issue's two placements to be built. Both were built on the real route: a tilted envelope with a wax seal straddling the card's top-right corner (≥ 64rem), and sealed letters on a crate beside a service bell, left of the card (≥ 80rem). Measured, both kept 2.5rem clear of text and left the card's height alone. But they only added decoration: the card was still all text, the seal poked out like a sticker, the vignette floated in the sky with nothing under it, and neither showed below 64rem. Their art is in `sources/` (`seal-*`, `vignette-*`); the masks are not shipped.
2. **A centered band above the boxes (kept).** The owner's own reference (an OTP card with an illustration centered above the title and boxes) put it where it breaks the text. With the intro and the second heading gone, it costs less than it adds.

An in-card mark beside the heading was ruled out on measurement: the strip beside the h1 had about 100px of room after the 2.5rem clear zone, and the description sat right under it.

## The clear-zone rule

`design-workflow.md` asks for 2.5rem around every line of text, "place art around the text rather than under it". That rule is about overlap: art over text, or hatching through letters. This art is in its own band, overlapping nothing, with the card's usual 1.25rem above and below, because 2.5rem on both sides would add 80px more to a card that already grew. This is an exception to the rule as written; the owner chose the placement. Say so in `design-workflow.md` if it is repeated.

## Recraft rounds (4 Oct, 12 credits)

`recraftv4_1`, two images per prompt, 2 credits each: 946 → 934. No crisp upscale: the mark shows at 112 CSS px, and the preview is enough. The shared frame is the error round's, with the scene sentence swapped.

| Art             | Credits | Pick  | Why                                                                                                                                                                                                                              |
| --------------- | ------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seal (rejected) | 4       | **2** | Clean outline, a little hatching and a legible seal. 1 shades the edges with scribbled hatching.                                                                                                                                 |
| Post (rejected) | 4       | **2** | Letters on an open crate with a bell, open paper around it. 1 is cleaner but the bell dominates.                                                                                                                                 |
| Slip (kept)     | 4       | **2** | A symmetrical open envelope with the slip showing, so it centers well. 1 reads as a sleeve with five boxes, off-centre. Pick 2's slip shows seven boxes, not six, which is subtle but may be noticed against the six real boxes. |

> Slip: Delicate 19th-century steel engraving of a single envelope lying flat with its flap open, and a small slip of paper drawn halfway out of it; on the slip a row of six small empty square boxes drawn in thin ink lines. Fine cross-hatching shading, thin black ink lines on plain white paper, monochrome. The envelope sits in the middle of the image as a free-standing vignette whose edges dissolve into blank white paper on every side; nothing touches the edges. Light, airy, sparse line work with open white areas, calm, museum-quality engraving. No text, lettering, digits, numbers, logos, signatures, borders, frames, people or dense dark areas.

The slip's source is the 608px preview (`sources/slip-2-608.jpg`); the full-size URL did not download from this network. Its ink is 332px wide after trimming, enough for the 256px mask. The seal and vignette prompts are in the history of PR #275's first commit.

## Asset pipeline

```sh
python3 docs/design/etched-login/prepare-etching.py docs/design/activate-mark/sources/slip-2-608.jpg apps/web/src/lib/assets/activate \
  --name vmb-activate-slip --trim --trim-x --widths 256 --white 235 --black 150
```

| Mask                    | Ink size  | Ratio | Weight  |
| ----------------------- | --------- | ----- | ------- |
| `vmb-activate-slip-256` | 332 × 294 | 1.129 | 7.8 KiB |

Hairline engraving vanishes at the default thresholds when scaled down, so it takes `--white 235 --black 150` to thicken it. `activate-art.test.ts` fails when the ratio in `ACTIVATE_ART` no longer matches its file.

## Verification

Chromium, dev build, the code step (reached with the `vmb_activate_sent` cookie the real action sets), the six review viewports, light and dark. Captures kept in `captures/`: 1440 × 900 light and dark, and 390 × 844 light.

| Viewport    | Card height | Page height, before → after |
| ----------- | ----------- | --------------------------- |
| 1920 × 1080 | 673 → 716   | 1080 → 1080                 |
| 1680 × 1000 | 673 → 716   | 1000 → 1000                 |
| 1440 × 900  | 673 → 716   | 900 → **940**               |
| 1366 × 768  | 673 → 716   | 897 → **940**               |
| 1024 × 923  | 673 → 716   | 923 → **940**               |
| 390 × 844   | 697 → 720   | 1104 → 1127                 |

- **The cost:** the card grew 43px net (the art and its two gaps, 139px, less the intro and second heading). Pages that fitted at 1440 × 900 and 1024 × 923 now scroll by 40px and 17px. 1366 × 768 and 390 × 844 scrolled before.
- **The knob:** at 112px the art is small beside the 365px row of boxes. A bigger mark costs about 0.9px of page height per px of width (the ratio is 1.129).
- **Gaps:** 20px above and below the art at every viewport, measured against the "Use a different email" link and the "Code" label.
- **Contrast:** the art carries no text and no text sits over it, so the text pairs are the ones in [auth field icons](../auth-field-icons/README.md). The ink is `--etching` in both schemes.
- **Not run:** Firefox and WebKit; the password-manager probe on this layout (the art is in flow and the fields are unchanged); the view-transition morph between steps in a real browser. The first round's `fullPage` captures lose the shell's art on a scrolling page (the sky, flock), so view the 1366 and 390 captures with a viewport capture.

## Deviations from the workflow

- **No separate stand-in.** Step 3 asks for stand-in art first. The owner had approved Recraft and its credits, and the cost was lower than a throwaway round, so generated art went straight onto the real route.
- **Two directions, then one.** The owner asked for the issue's two placements; they were built, compared and replaced by the owner's own layout.
- **Chromium only.**

## Owner review

To do, in the owner's own browser at native size, with their extensions installed:

- [ ] Does the card now read as less of a wall of text? Light and dark.
- [ ] Is the 112px art big enough, or should it grow?
- [ ] The slip shows seven boxes against the six real ones. Fine, or worth another generation (4 credits)?
- [ ] The page now scrolls 40px at 1440 × 900. Acceptable, or should the card give some height back?
- [ ] 1Password / Bitwarden badges: no overlap with the boxes, no shift.
