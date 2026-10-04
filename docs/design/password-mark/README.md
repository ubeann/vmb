# Activate: an etched mark for the password step — design round

A follow-up to [activate-mark](../activate-mark/README.md) (#273), for the new-password step of `/activate` (#256, PR #276). Same territory, so no new token and no ADR.

## What ships

The password step takes the code step's layout: the card's heading is the step's own ("Choose a new password"), the page intro and the second heading are left out, and an etched mark sits in its own band above the field.

| Part         | Before                                                             | After                                                                             |
| ------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Page heading | "Set your password" with a second "Choose a new password" under it | "Choose a new password"; "Code confirmed…" stays as the description line          |
| Intro        | "First time here or forgot your password? …"                       | Left out: it explains the email step                                              |
| Art          | none                                                               | `ACTIVATE_ART.padlock`, a closed padlock with a key beside it, 5rem wide          |
| Rules        | "At least 12 characters" (icon swapped instantly), passphrase hint | One length bar: a tick at 12, text beside it; the hint moved into the description |

The length bar is one meter for the rule and the advice (ADR-0041). It fills to 20 characters with a tick at 12, grey below the minimum and `--primary` from it, so an acceptable password never reads as red or orange. Text says the same: "At least 12 characters", then "7 more characters", then Okay (12–15), Good (16–19) and Strong (20+). It reads length alone, so it cannot call `Password1!` strong the way a composition meter does, and it is a `role="meter"` so a screen reader gets the value and the words.

A password built from the email name or "VMB" is named as it is typed ("Leave "rina.wijaya" out of your password") and stops the form in the browser; the server refuses it too. The line's space is always on the page, so nothing moves when it appears.

The owner's reference was a bar with a "Must contain" list. The list is the composition rules ADR-0041 leaves out, so only the bar was taken.

## Recraft (4 Oct, 4 credits)

`recraftv4_1`, two images, 2 credits each: 934 → 930. No crisp upscale: the mark shows at 80 CSS px. The prompt is the activate-mark slip's frame with the scene swapped:

> Delicate 19th-century steel engraving of a single closed padlock with a small old-fashioned key lying beside it. Fine cross-hatching shading, thin black ink lines on plain white paper, monochrome. The padlock and key sit in the middle of the image as a free-standing vignette whose edges dissolve into blank white paper on every side; nothing touches the edges. Light, airy, sparse line work with open white areas, calm, museum-quality engraving. No text, lettering, digits, numbers, logos, signatures, borders, frames, people or dense dark areas.

| Pick  | Why                                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------- |
| **1** | Larger and centred, with stronger line weight that survives the mask at 80px.                            |
| 2     | Small in its frame and fine-lined; it would thin out at display size. Kept in `sources/` for the record. |

```sh
python3 docs/design/etched-login/prepare-etching.py docs/design/password-mark/sources/padlock-1-1024.webp apps/web/src/lib/assets/activate \
  --name vmb-activate-padlock --trim --trim-x --widths 256 --white 235 --black 150
```

Mask: `vmb-activate-padlock-256`, 360 × 480, ratio 0.750, 8.3 KiB. `activate-art.test.ts` checks the ratio.

## Not yet verified

Measured captures at the review viewports (`design-screenshots.mjs`) and the owner's own-browser review (workflow steps 6 and 7) are still to do; the preview on PR #276 is where to look.
