# Etched login — design round

The auth pages (`/login`, `/activate`) redesigned as an engraved plate. It follows the design workflow trial in `docs/design/workflow.md` on the research branch `t3code/design-workflow-research`: brand brief → style territory → storyboard → asset → motion → rendered critique.

## Brief

- **Brand idea:** _Every crate, container and receipt, on record._ VMB keeps warehouse items, trucking orders and division expenses. Engraving is the visual language of ledgers, share certificates and banknotes, so it signals record-keeping and trust. The logo's striped letterforms already look like engraved line work.
- **Palette:** navy ink and the logo green on warm paper ([ADR-0036](../../adr/0036-navy-and-green-brand-palette.md)).
- **Type:** Newsreader for display headings, Inter for everything else.
- **Scene:** warehouses, container trucks crossing a bridge, and a container yard, shown as separate places in one landscape. There are no arrows or paths between them, so the picture doesn't suggest one process runs into the next (a finding from the research round's critique).

## Composition

| Viewport          | Layout                                                                                                                                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop (≥ 64rem) | Masthead (logo, "Warehouse · Trucking · Expense"); brand line on the left, form sheet on the right; the engraving is pinned to the bottom of the viewport, so the page never scrolls. On short screens the sheet overlaps the plate like paper laid on it. |
| Tablet            | Same stack as mobile, with a 30vh plate.                                                                                                                                                                                                                   |
| Mobile            | Logo, brand line, form, then the plate as a short ribbon (22vh, max 12rem) that crops to the bridge and trucks. The fields and submit button sit above the fold at 390 × 844.                                                                              |

## Storyboard

| State          | Behaviour                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrival        | The form is ready immediately. The plate draws in once, left to right like a press roller: a mask sweep over 1.6 s, ease-in-out, starting after 150 ms. |
| Seal           | On desktop, a faint guilloché rosette behind the sheet is cut in by a turning sweep (2.4 s, starting after 400 ms). It is hidden on small screens.      |
| Focus          | The green ring and border from the design system. Nothing else moves.                                                                                   |
| Password       | The eye toggle shows or hides the characters (`aria-pressed`, fixed label "Show password").                                                             |
| Submitting     | The button changes to "Signing in…" with a spinner and is disabled until the action settles.                                                            |
| Error          | Field message under the field with `aria-invalid`, or a form-level alert with an icon. No shake.                                                        |
| Success        | Server redirect; there is no success animation to wait for.                                                                                             |
| Reduced motion | The plate is shown finished; the spinner collapses under the global reduced-motion rule.                                                                |
| Dark           | The same mask filled with the dark `--etching` token, so the plate reads as a blueprint on navy.                                                        |

## Asset pipeline

The plate is a single-colour **alpha mask**: black RGB with ink density in the alpha channel. `EtchedScene.svelte` fills it with `--etching` through CSS `mask-image`, so there's no second file for dark mode and the colour stays a token.

```sh
python3 docs/design/etched-login/prepare-etching.py <engraving.png> apps/web/src/lib/assets/auth
```

The script writes 2400px and 1200px WebPs. It treats luminance ≥ 212 as bare paper, which keeps paper grain out of the alpha channel: with grain kept and higher quality settings, the stand-in's 2400px file was 846 KB; now it is 333 KB.

The sheet's rosette is drawn in code rather than generated: `make-rosette.py` writes `vmb-rosette.svg`, which holds bands of phase-shifted wavy rings, as on a banknote seal (65 KB, 28 KB gzipped). `Rosette.svelte` uses it as a mask filled with 28% `--etching`.

```sh
python3 docs/design/etched-login/make-rosette.py apps/web/src/lib/assets/auth/vmb-rosette.svg
```

**Current art is a stand-in.** `stand-in-panorama.jpg` was generated with Pen's AI image generation to test the composition. Its production rights are unverified, so the final plate should come from the Recraft kit below.

## Recraft kit (Basic plan, ~1,000 credits)

The Recraft MCP (`https://mcp.recraft.ai/mcp`, OAuth) spends the same subscription credits, so an agent can run these steps directly. On 28 Sep it failed to connect from the maintainer's network: `api.recraft.ai` and `mcp.recraft.ai` sit on Cloudflare IPs (`104.26.6.194`, `104.26.7.194`, `172.67.75.83`) whose TLS connections are reset, while `www.recraft.ai` loads. Retry over a VPN or Cloudflare WARP; the steps below also work by hand in Recraft Studio.

1. **Build a custom style** (Styles → create), from 3–5 public-domain 19th-century steel engravings of harbours, warehouses or river towns. The Rijksmuseum's public-domain print collection has many Dutch East Indies harbour views. You can add `stand-in-panorama.jpg` as one reference. Don't use the Native site's artwork: it's another company's brand asset.
2. **Model:** Recraft V4.1 raster (2 credits per image) for exploration, and V4.1 Pro (10 credits) for the chosen final. Don't use vector output: real hatching becomes tens of thousands of paths, too heavy to ship.
3. **Size:** the widest landscape option, at least 2400px wide once upscaled (Crisp upscale is 1 credit).
4. **Prompt**, with your custom style applied:

   > Wide panoramic 19th-century steel engraving, fine cross-hatching and stipple, black ink on plain white paper. A tropical Indonesian logistics landscape seen from slight elevation: on the left a row of long pitched-roof timber warehouses with loading docks and stacked crates; in the centre a stone-and-steel truss bridge over a calm river with three container trucks crossing, each carrying one shipping container; on the right a container yard with stacked containers, two gantry cranes and a modest colonial office building. Palm trees and distant volcanic mountains behind. The scene fills only the bottom 55% of the image and fades into blank paper at the top and both sides. Even line weight, calm and orderly. No text, lettering, logos, signatures, borders or foreground people.

5. **Variations to try, 2–3 images each:** (a) the prompt as written; (b) "larger, simpler forms, fewer and bolder hatching lines", which survives the mobile ribbon better; (c) a harbour-weighted version with the container yard centred.
6. **Logo:** run **Vectorize** (1 credit) on `vmb-warehouse/public/img/logo.png`. The current PNG is 229px wide, soft on high-density screens, and its navy swoosh disappears on the dark background. An SVG allows a dark-mode variant.
7. **Hand-off:** put the PNGs in `docs/design/etched-login/candidates/`. Each goes through `prepare-etching.py` and is compared in the browser at 1440 × 900, 1366 × 768 and 390 × 844, in light and dark.

Estimated use: about 15 explorations × 2 + 2 Pro finals × 10 + upscales and vectorize ≈ **55 credits**, around 5% of the month's allowance.

## Checked

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (95 tests) in `apps/web`.
- Rendered in the browser at 1440 × 900, 1366 × 768 and 390 × 844, in light and dark. The desktop page doesn't scroll, and the mobile fields and submit button are above the fold.
- Sampled the reveal progress (10% → 44% → 95% between 0.6 s and 1.2 s) and ran the password toggle both ways.

## Not yet checked

- A real sign-in against the API; the local dev server had no `API_URL`.
- The reduced-motion emulation, 200% zoom, screen readers, and password-manager autofill with the toggle.
- Real-device performance of the 333 KB WebP mask; AVIF may cut it further.
