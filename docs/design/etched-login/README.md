# Etched login — design round

The auth pages (`/login`, `/activate`) redesigned as an engraved plate. It follows the design workflow trial in `docs/design/workflow.md` on the research branch `t3code/design-workflow-research`: brand brief → style territory → storyboard → asset → motion → rendered critique.

## Brief

- **Brand idea:** _Every crate, container and receipt, on record._ VMB keeps warehouse items, trucking orders and division expenses. Engraving is the visual language of ledgers, share certificates and banknotes, so it signals record-keeping and trust. The logo's striped letterforms already look like engraved line work.
- **Palette:** navy ink and the logo green on warm paper ([ADR-0036](../../adr/0036-navy-and-green-brand-palette.md)).
- **Type:** Newsreader for display headings, Inter for everything else.
- **Scene:** warehouses, container trucks crossing a bridge, and a container yard, shown as separate places in one landscape. There are no arrows or paths between them, so the picture doesn't suggest one process runs into the next (a finding from the research round's critique).

## Composition

| Viewport          | Layout                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop (≥ 64rem) | Masthead (logo, "Warehouse · Trucking · Expense"); brand line on the left, form sheet on the right; an engraved sky (clouds, low sun, seabirds) behind the right half; the landscape is pinned to the bottom of the viewport, so the page never scrolls. On short screens the sheet overlaps the plate like paper laid on it. |
| Tablet            | Same stack as mobile, with a 30vh plate and no sky.                                                                                                                                                                                                                                                                           |
| Mobile            | Logo, brand line, form, then the plate as a short ribbon (22vh, max 12rem) showing the whole scene; no sky. The fields and submit button sit above the fold at 390 × 844.                                                                                                                                                     |

## Storyboard

| State          | Behaviour                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrival        | The form is ready immediately. The plate draws in once, left to right like a press roller: a mask sweep over 1.6 s, ease-in-out, starting after 150 ms.               |
| Sky            | On desktop, the sky fades in and settles 2.5rem to the left over 2.4 s, starting after 900 ms, then stops. It never loops, so it needs no pause control (WCAG 2.2.2). |
| Focus          | The green ring and border from the design system. Nothing else moves.                                                                                                 |
| Password       | The eye toggle shows or hides the characters (`aria-pressed`, fixed label "Show password").                                                                           |
| Submitting     | The button changes to "Signing in…" with a spinner and is disabled until the action settles.                                                                          |
| Error          | Field message under the field with `aria-invalid`, or a form-level alert with an icon. No shake.                                                                      |
| Success        | Server redirect; there is no success animation to wait for.                                                                                                           |
| Reduced motion | Plate and sky are shown finished; the spinner collapses under the global reduced-motion rule.                                                                         |
| Dark           | The same masks filled with the dark `--etching` token, so the plate reads as a blueprint on navy; the logo swoosh turns paper-coloured (`--brand-mark`).              |

## Asset pipeline

Both engravings are single-colour **alpha masks**: black RGB with ink density in the alpha channel. `EtchedScene.svelte` (landscape) and `EtchedSky.svelte` (sky, at a 45% wash) fill them with `--etching` through CSS `mask-image`, so there's no second file for dark mode and the colour stays a token. The sky's mask also fades out over the masthead band and the headline column.

```sh
python3 docs/design/etched-login/prepare-etching.py docs/design/etched-login/sources/landscape-a1-4096.jpg apps/web/src/lib/assets/auth
python3 docs/design/etched-login/prepare-etching.py docs/design/etched-login/sources/sky-2-1536.jpg apps/web/src/lib/assets/auth --name vmb-sky
```

The script writes 2400px and 1200px WebPs (landscape 283 KB and 80 KB, sky 54 KB and 18 KB). It treats luminance ≥ 212 as bare paper, which keeps paper grain out of the alpha channel.

The logo is `VmbLogo.svelte`, an inline SVG of the legacy mark: navy swoosh on `--brand-mark`, green stripes on `--primary`. `vmb-logo.svg` is the same mark in fixed brand colours for use outside the app.

## Recraft round (28 Sep, 18 credits)

The art comes from Recraft on the paid Basic plan, so VMB holds commercial rights to it. Generation ran through Recraft's MCP (`https://mcp.recraft.ai/mcp`, OAuth), which spends the same subscription credits as Studio. The MCP's hosts sit on Cloudflare IPs that one office network resets; it connects from other networks.

| Step                | Settings                        | Credits | Result                                                                                                                                                        |
| ------------------- | ------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landscape A, B      | `recraftv4_1`, 2:1, n 2 each    | 8       | **A1 chosen**: clear, separate warehouse, bridge and yard, light enough to sit under text. A2 is cut in an oval vignette; B1 and B2 are heavy black woodcuts. |
| Sky C               | same, n 2                       | 4       | Both too dark or fully hatched behind the headline.                                                                                                           |
| Sky, lighter prompt | same, n 2                       | 4       | **Sky 2 chosen**: clouds and sun on the right, left half empty.                                                                                               |
| Crisp upscale A1    | 1536 → 4096 px                  | 1       | Source for the 2400px mask.                                                                                                                                   |
| Vectorize logo      | from the legacy PNG enlarged 4× | 1       | 23 paths; the background and 5 anti-alias fragments were removed by hand.                                                                                     |

`sources/candidates-round-1-2.jpg` shows every candidate. The two prompts that were kept:

> **Landscape:** Wide panoramic 19th-century steel engraving, fine cross-hatching and stipple, black ink on plain white paper, monochrome. A tropical Indonesian logistics landscape seen from slight elevation: on the left a row of long pitched-roof timber warehouses with loading docks and stacked crates; in the centre a stone-and-steel truss bridge over a calm river with three container trucks crossing, each carrying one shipping container; on the right a container yard with stacked shipping containers, two gantry cranes and a modest colonial office building. Palm trees and distant volcanic mountains behind. The scene fills only the bottom half of the image and fades into blank white paper at the top and at both sides. Even line weight, calm and orderly, museum-quality engraving. No text, lettering, logos, signatures, borders or foreground people.

> **Sky:** Delicate 19th-century steel engraving of a calm tropical sky only, thin black ink lines on plain white paper, monochrome, very light and airy: two or three soft cumulus clouds drawn with sparse fine parallel hatching and open white interiors, a low sun on the right with thin radiating engraved rays fading out, and three or four tiny distant seabirds. At least two thirds of the image is empty white paper, especially the left half and the bottom edge. No land, no horizon line, no buildings, no text, no border, no frame, no dense dark areas.

A guilloché rosette behind the sheet was tried and removed: its rings tangled with the sun's rays. It is in commit `5a900cd` if a later screen wants it.

## Checked

- `pnpm typecheck`, `pnpm lint`, `pnpm test` in `apps/web`.
- Playwright renders at 1440 × 900, 1366 × 768 and 390 × 844, in light and dark: the desktop page doesn't scroll, the sky clears the masthead and headline, and the mobile fields and submit button are above the fold.
- Sampled the reveal progress (10% → 44% → 95% between 0.6 s and 1.2 s) and ran the password toggle both ways.

## Not yet checked

- A real sign-in against the API; the local dev server had no `API_URL`.
- The reduced-motion emulation, 200% zoom, screen readers, and password-manager autofill with the toggle.
- Real-device loading of the 283 KB landscape mask; AVIF may cut it further.
- The traced logo edges at large sizes. It is sharp at header size; a designer's redraw would be the long-term master.
