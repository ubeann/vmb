# Etched login — design round

The auth pages (`/login`, `/activate`) redesigned as an engraved plate. This round was the pilot for the [design workflow](../../agents/design-workflow.md), and is its worked example.

## Brief

- **Brand idea:** _Every crate, container and receipt, on record._ VMB keeps warehouse items, trucking orders and division expenses. Engraving is the visual language of ledgers, share certificates and banknotes, so it signals record-keeping and trust. The logo's striped letterforms already look like engraved line work.
- **Palette:** navy ink and the logo green on warm paper ([ADR-0036](../../adr/0036-navy-and-green-brand-palette.md)).
- **Type:** Newsreader for display headings, Inter for everything else.
- **Scene:** warehouses, container trucks crossing a bridge, and a container yard, shown as separate places in one landscape. There are no arrows or paths between them, so the picture doesn't suggest one process runs into the next (a finding from the research round's critique).

## Composition

| Viewport          | Layout                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop (≥ 64rem) | Masthead (logo, "Warehouse · Trucking · Expense"); brand line on the left, form sheet on the right; an engraved sky (clouds, low sun, seabirds) behind the right half; a small flock over a cloud bank under the brand line, clear of the text, on screens at least 56rem tall; the landscape fades into a footer strip at the bottom of the viewport, so the page doesn't scroll. On short screens the sheet overlaps the plate like paper laid on it. |
| Tablet            | Same stack as mobile, with a 30vh plate and no sky.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Mobile            | Logo, brand line, form, then the plate as a short ribbon (22vh, max 12rem) showing the whole scene, then the footer strip; no sky. The fields and submit button sit above the fold at 390 × 844.                                                                                                                                                                                                                                                        |

## Storyboard

| State          | Behaviour                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrival        | The form is ready immediately. The plate draws in once, left to right like a press roller: a mask sweep over 1.6 s, ease-in-out, starting after 150 ms.               |
| Sky            | On desktop, the sky fades in and settles 2.5rem to the left over 2.4 s, starting after 900 ms, then stops. It never loops, so it needs no pause control (WCAG 2.2.2). |
| Flock          | On desktops at least 56rem tall, the flock fades in and settles 1.5rem over 2.4 s, starting after 1.3 s, then stops.                                                  |
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
python3 docs/design/etched-login/prepare-etching.py docs/design/etched-login/sources/landscape-a1-4096.jpg apps/web/src/lib/assets/auth --trim --trim-x --crop-bottom 0.08 --flip --fade-sides 0.06 --fade-bottom 0.30 --pad-to 5
python3 docs/design/etched-login/prepare-etching.py docs/design/etched-login/sources/sky-2-1536.jpg apps/web/src/lib/assets/auth --name vmb-sky
python3 docs/design/etched-login/prepare-etching.py docs/design/etched-login/sources/flock-2-1536.jpg apps/web/src/lib/assets/auth --name vmb-flock --trim --trim-x
```

The script writes 2400px and 1200px WebPs (landscape 163 KB and 43 KB, sky 54 KB and 18 KB, flock 15 KB; only the flock's 1200px file ships, since it is drawn at 26rem). It treats luminance ≥ 212 as bare paper, which keeps paper grain out of the alpha channel. For the landscape (#219), in the order the script applies them:

| Option               | What it does                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--trim`, `--trim-x` | Crop the empty paper around the ink. The plate is 4047 × 1106 (3.7:1) at this point.                                                                                   |
| `--crop-bottom 0.08` | Cut 8% of the height from the bottom: foreground tufts, not structure. The scene draws about 8% larger at the same band height, and the art's own ratio becomes 4.0:1. |
| `--flip`             | Mirror the art, which puts the gantry cranes on the left and the warehouses on the right, clear of the form sheet (see _Wider plate_).                                 |
| `--fade-sides 0.06`  | Bake a soft fade into both edges.                                                                                                                                      |
| `--fade-bottom 0.30` | Thin the bottom 30% of the height into bare paper, so the plate meets the footer without an edge.                                                                      |
| `--pad-to 5`         | Add blank paper at both sides to reach 5:1 (5090 × 1018), so the CSS can bleed the plate off narrow screens without cutting the scene.                                 |

`EtchedScene` fits the plate to the band's height (`mask-size: auto 100%`) and sizes the band from two ratios: `--plate-ratio` (5, the whole plate) and `--plate-core-ratio` (4, the art without its padding). Update both whenever the plate changes; `etched-scene.test.ts` fails when `--plate-ratio` no longer matches the shipped mask.

The logo is `VmbLogo.svelte`, an inline SVG of the legacy mark, vectorized by Recraft from a crisp upscale of the 229px PNG (#219): navy swoosh on `--brand-mark`, green stripes on `--primary`. `vmb-logo.svg` is the same mark in fixed brand colours for use outside the app.

The icon set and link-preview image in `apps/web/static` are built from `vmb-logo.svg` and the 2400px landscape mask (#207). The script lives with the artwork and uses Playwright and the fonts from `apps/web/node_modules`. Rerun it after either source changes:

```sh
node docs/design/etched-login/build-brand-assets.mjs
```

`favicon.svg` is the full mark, not a redraw. At 16px the letters cut out of the green blur, but the swoosh-and-oval silhouette stays recognisable; a legible 16px glyph would need a designer's simplified mark. It is transparent and switches to the dark palette with `prefers-color-scheme`. `favicon.ico` (32px, 1.4 KB) and `apple-touch-icon.png` (180px, 6.7 KB) sit on an opaque paper tile, since neither can switch scheme. `og-image.jpg` (1200 × 630, 110 KB) is the auth page in miniature. It is a JPEG because WhatsApp drops preview images over about 300 KB.

## Recraft rounds (28 Sep, 22 credits; 29 Sep, 23 credits)

The art comes from Recraft on the paid Basic plan, so VMB holds commercial rights to it. Generation ran through Recraft's MCP (`https://mcp.recraft.ai/mcp`, OAuth), which spends the same subscription credits as Studio. The MCP's hosts sit on Cloudflare IPs that one office network resets; it connects from other networks.

| Step                | Settings                        | Credits | Result                                                                                                                                                        |
| ------------------- | ------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landscape A, B      | `recraftv4_1`, 2:1, n 2 each    | 8       | **A1 chosen**: clear, separate warehouse, bridge and yard, light enough to sit under text. A2 is cut in an oval vignette; B1 and B2 are heavy black woodcuts. |
| Sky C               | same, n 2                       | 4       | Both too dark or fully hatched behind the headline.                                                                                                           |
| Sky, lighter prompt | same, n 2                       | 4       | **Sky 2 chosen**: clouds and sun on the right, left half empty.                                                                                               |
| Crisp upscale A1    | 1536 → 4096 px                  | 1       | Source for the 2400px mask.                                                                                                                                   |
| Vectorize logo      | from the legacy PNG enlarged 4× | 1       | 23 paths; the background and 5 anti-alias fragments were removed by hand.                                                                                     |

**Round 2 (#219, 29 Sep).** The goal was a wider plate composed for the footer strip. Twenty-one credits of new landscape art went unused; the plate that shipped is round 1's A1, cut and mirrored. The candidates all had to satisfy the same composition rules (no tall shapes in the sheet zone, sparse sides, foreground into paper).

| Step                  | Settings                                | Credits | Result                                                                                                                                                                                |
| --------------------- | --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landscape A, B (band) | `recraftv4_1`, 2:1, n 2 each            | 8       | A1 is clean but trimmed to 7.3:1, too thin: subjects draw small and the tall-screen gap grows. A2's cranes sit in the sheet zone. B1 and B2 bleed dense reeds to the edges.           |
| Landscape C (refined) | same, n 2                               | 4       | C1 is the richest at 3.7:1, but its cranes land at 64–76% of the width, under the sheet. Mirroring fixes that.                                                                        |
| Landscape D (lighter) | same, n 2                               | 4       | D2 is lighter, but its trucks read as rail cars and its warehouses are faint. D1 is 6.5:1 with cranes against the edge.                                                               |
| Image to image on A1  | strength 0.5, input pre-stretched 1.25× | 4       | E1 keeps the layout at 4.6:1 but adds palms and a crane reflection that runs to the bottom edge; E2 moves the cranes into the sheet zone. Drifted too far from A1.                    |
| Crisp upscale (A1)    | 1536 → 4096 px                          | 1       | Not used.                                                                                                                                                                             |
| Logo: crisp upscale   | legacy 229px PNG → 916 × 664            | 1       | A cleaner input than a plain 4× resize.                                                                                                                                               |
| Logo: vectorize       | `vectorize_image` on the upscale        | 1       | 19 paths in the same 2048 × 1485 frame as the old trace: a white background rectangle (removed), one 46 × 11 anti-alias speck at the swoosh tip (removed), the swoosh and 16 stripes. |

The balance went 1008 → 987 → 985. This session's Recraft tools had failed to connect on the office network, so both logo steps ran through a headless `claude -p` call with `--allowedTools "mcp__recraft__*"`, on a phone hotspot.

The landscape decision: cropping the pilot's top could not reach 5:1. The trimmed band (3.7:1) has crane jibs 2–4% from its top edge and roofs at about 18%, so a 20–25% top cut (ratio 4.6–4.9) amputates the cranes. The foreground is the expendable part: grass and water hatching stay dense to about 95% of the band height, so it needs a fade, and an 8% cut plus a 30% fade keeps the bridge crisp. At 15% the cut reaches the bridge piers, and at 22% the bridge deck fades out.
`sources/candidates-round-1-2.jpg` shows every candidate. The two prompts that were kept:

> **Landscape:** Wide panoramic 19th-century steel engraving, fine cross-hatching and stipple, black ink on plain white paper, monochrome. A tropical Indonesian logistics landscape seen from slight elevation: on the left a row of long pitched-roof timber warehouses with loading docks and stacked crates; in the centre a stone-and-steel truss bridge over a calm river with three container trucks crossing, each carrying one shipping container; on the right a container yard with stacked shipping containers, two gantry cranes and a modest colonial office building. Palm trees and distant volcanic mountains behind. The scene fills only the bottom half of the image and fades into blank white paper at the top and at both sides. Even line weight, calm and orderly, museum-quality engraving. No text, lettering, logos, signatures, borders or foreground people.

> **Sky:** Delicate 19th-century steel engraving of a calm tropical sky only, thin black ink lines on plain white paper, monochrome, very light and airy: two or three soft cumulus clouds drawn with sparse fine parallel hatching and open white interiors, a low sun on the right with thin radiating engraved rays fading out, and three or four tiny distant seabirds. At least two thirds of the image is empty white paper, especially the left half and the bottom edge. No land, no horizon line, no buildings, no text, no border, no frame, no dense dark areas.

The flock prompt, for the left column: _Delicate 19th-century steel engraving, thin black ink lines on plain white paper, monochrome, very light and airy: a small loose flock of seven to nine seabirds, frigatebirds and terns, gliding in a gentle diagonal from lower left to upper right, above a thin low horizontal bank of soft cumulus clouds drawn with sparse fine parallel hatching and open white interiors. The birds and clouds sit in the middle of the image with generous empty white paper on every side; nothing touches the edges. No land, no horizon line, no sun, no buildings, no text, no border, no frame, no dense dark areas._

**Ornaments stay off the text.** A mirrored sky behind the headline was mocked up: at a 20% wash the headline still measures 10.8:1, but the 16px supporting line drops to 4.2:1 (below 4.5:1), hatching through letters reads as a printing flaw, and the mirror repeats the right-hand composition. The flock instead frames the column from below, 2.5rem clear of the text.

**The footer strip sits under the plate (#203).** The plate's bottom fades into the paper (first a CSS mask gradient, `--etched-scene-fade`; since #219 the fade is baked into the art and the variable is gone), then one line, 2.5rem clear of the last visible ink: the copyright for PT. Vifiera Minova Bersaudara, the support team's address (Lucide `mail` icon) and the developer credit (GitHub's mark, `GitHubMark.svelte`; Lucide no longer ships brand icons). A hairline rule between plate and strip came first; the fade replaced it so the scene ends softly instead of on a hard edge. From 64rem the band gives up the strip's height (`--etched-scene-reserve`, 4.5rem and 5.5rem on touch pointers, where the links grow to 44px, until #219 tightened it), so the plate's top edge and its clearance from the brand line don't move. In #203 the plate got shorter, and so narrower: at 1440 × 900 it no longer spanned the viewport and its baked side fades showed. #219 fixes that. A first attempt put the copyright on an opaque chip over the plate's corner, because text placed above the plate collided with the sheet at every desktop size except 1024 × 923. It is in the history of PR #217. The strip lists one address only: the department inboxes belong in the signed-in shell (#218), since a public page listing them gives phishers a verified list of addresses to impersonate.

**Wider plate (#219).** Three problems from the footer strip, and what fixed each:

- _The plate's ends showed._ The 3.7:1 plate was fitted to the band's height, which the strip's reserve had shortened. The new plate is padded to 5:1 with a sparse, faded edge, and the band is at least `100vw ÷ 5` tall from 64rem, so it always spans the viewport. It is at most `100vw ÷ 4` (the art's own ratio), so the scene is never cropped at the sides. From 80rem wide and 56rem tall, where the flock sits, it also grows into the room above the plate: `--etched-scene-headroom` (set in `AuthShell`, the flock's bottom edge at 505px plus its 2.5rem clear zone) lets the band grow until its ink spans the viewport (`--plate-ink-ratio`, 3.85, since the ink is 77% of the plate's width), and no further. Trimming more of the bottom was considered and rejected: filling 1680px that way needs about a 19% cut, and the bridge fades at 15–22%. Below 80rem, or with no flock, the band keeps its earlier height.
- _The sheet hid the container yard._ At 1366–1680 the sheet covers about 62–88% of the width and the top 40% of the plate. Mirroring the art moves the cranes to about 24–37% of the width and the yard to the left; the warehouse roofs now tuck under the sheet's lower corner, as if the paper lay over them.
- _Tall screens left a gap._ At 1440 × 1284 the sheet-to-plate gap is 239px (master: 262px).

Below 64rem the footer's two links are 44px icon buttons (mail, GitHub) with the name in the `aria-label`, in a row with the copyright at every width (the copyright wraps to two lines below about 380px); the desktop text links are unchanged. The footer's top padding also dropped from 2.5rem to 1.25rem from 64rem (mobile keeps 2.5rem), with the reserve at 3.25rem (4.25rem on touch). That works because the art's last 8% is almost bare paper: the ink is 10% opaque about 7.7% of the plate's height above its bottom edge, and 25% opaque about 11% above. The extra padding was spare clear zone.

| Viewport    | Plate height | Blank paper per side | Gap to flock | Text to 10% ink | Page |
| ----------- | ------------ | -------------------- | ------------ | --------------- | ---- |
| 1920 × 1080 | 483px        | 30px                 | 40px         | 61px            | fits |
| 1680 × 1050 | 436px        | 0                    | 57px         | 58px            | fits |
| 1680 × 1000 | 403px        | 64px                 | 40px         | 55px            | fits |
| 1440 × 900  | 308px        | 127px                | 35px         | 48px            | fits |
| 1366 × 768  | 286px        | 133px                | no flock     | 46px            | fits |
| 1280 × 800  | 268px        | 124px                | no flock     | 45px            | fits |
| 1440 × 1284 | 374px        | 0                    | 353px        | 53px            | fits |
| 1024 × 923  | 205px        | 118px                | 11px         | 40px            | fits |
| 2560 × 1440 | 665px        | 0                    | 218px        | 75px            | fits |

The 40px minimum is 2.5rem, so the clear zone holds, exactly at 1024 × 923. Blank paper is the plate's margin beyond its ink, estimated from the mask (ink is 77% of the plate). At 1440 × 900 and below the room above the plate is the limit, so a soft vignette of about 127px per side stays. At 1366 × 768 the sheet covers the bridge's right end and the warehouses, and the mobile ribbon (390 × 844) still shows the warehouses, bridge and yard. The 390 × 844 page scrolls to 896px (932px before the icon footer), with the fields and submit button above the fold. The plate top is the same as, or lower than, master's at every size except 1440 × 1284, where it rises 23px on purpose. Those master numbers come from the old CSS formula, not from a master render.

**The sky's crop (#219).** The sky art is 2:1 and its box is at most 36rem tall, so `cover` shows only 60–69% of the art at 1440–1920 wide (45% at 2560, 76% at 1180, all of it at 1024 × 923). Anchored at the top, that cut the low sun (rows 50–79% of the art) in half at 1920 × 1080 and hid it entirely at 2560 × 1440. It is now anchored at `right 60%`, which shows the whole sun at every size that crops at all and drops the empty paper below it. That pulled a dense cloud up under the masthead tagline, so the sky's top fade moved from 4–9rem to 7–11rem (the tagline ends about 4.5rem down). Sky ink in the 2.5rem band under the tagline, measured as screenshot darkening with the sky on and off: 0.1–0.7 (mean, out of 255) before, 0.9–3.1 with only the new anchor, 0 at every size from 1180 to 2560 wide with the new fade.

A guilloché rosette behind the sheet was tried and removed: its rings tangled with the sun's rays. It is in commit `5a900cd` if a later screen wants it.

## Checked

- `pnpm typecheck`, `pnpm lint`, `pnpm test` in `apps/web`.
- Playwright renders at 1440 × 900, 1366 × 768 and 390 × 844, in light and dark: the desktop page doesn't scroll, the sky clears the masthead and headline, and the mobile fields and submit button are above the fold.
- Sampled the reveal progress (10% → 44% → 95% between 0.6 s and 1.2 s) and ran the password toggle both ways.
- Footer strip (#203): `design-screenshots.mjs` fits at every desktop review viewport, light and dark. Contrast on paper: `--muted-foreground` 5.99:1 light and 8.45:1 dark, `--foreground` links 15.44:1 and 16.28:1. With touch emulated, the links measure 44px and every desktop size still fits, including iPad landscape (1366 × 1024, 1180 × 820, 1024 × 768). The activate page's code step (forced on locally, since the capture script can't reach it) needs 807px without the strip, so it already scrolled at 1366 × 768. It needs 879px with the strip and still fits at every other desktop review viewport.

- Wider plate (#219): `design-screenshots.mjs` fits at every desktop review viewport, light and dark; the mobile capture scrolls to 932px with the fields and submit above the fold. Opened by eye: 1440 × 900 and 1440 × 1284 in light, 1024 × 923 and 390 × 844 in dark. The other captures were only checked for scroll, and the table above comes from a Playwright probe of the plate and footer boxes. `pnpm test` in `apps/web` passes (119 tests, including the plate-ratio test). The logo was compared with the old trace at 1200px and in the header in light mode; the dark header was looked at in the page captures.

## Fixed after review

- **Plate cropped on wide screens:** with the 2:1 source and `mask-size: cover`, a band wider than about 3:1 scaled the plate to its width and cut off the scene's top (warehouse roofs, cranes) at 1680 × 1000. Fixed by trimming the source and fitting it by height, as above.
- **Sheet grows when a field is focused:** password-manager extensions insert an element after the focused input; inside a `space-y-2` field it picked up an 8px margin. Every auth input now sits in its own wrapper, so injected elements land inside it. Checked by injecting an element after each input: sheet height stays the same.

## Not yet checked

- A real sign-in against the API; the local dev server had no `API_URL`.
- The reduced-motion emulation, 200% zoom, screen readers, and password-manager autofill with the toggle.
- Real-device loading of the 167 KB landscape mask; AVIF may cut it further (not measured yet).
- The tall-screen gap on the other tall viewports.
- The traced logo edges at very large sizes. The Recraft trace from the crisp upscale is smooth at 1200px and sharp at header size, but a designer's redraw would still be the long-term master.
