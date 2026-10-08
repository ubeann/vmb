# Design workflow: a screen's look, art and motion

How to take a screen from a working-but-plain UI to a branded one, as proven on the auth pages (#196, PR #197). The worked example, with its brief, storyboard, prompts, credit log and review fixes, is `docs/design/etched-login/README.md`. Read it alongside this doc; it is the reference for what each step produces.

Each design round gets its own folder, `docs/design/<round>/`, holding the round README, the chosen `sources/`, and any asset scripts.

## Steps

1. **Brief from brand evidence.** Write a short brief: who uses the screen, what VMB does for them (use `GLOSSARY.md` terms), the brand line, the scene or motif, and the palette. Tie the style to something VMB already owns. In the pilot, the logo's striped letterforms read as engraving, which made engraving the natural style. Show VMB's separate domains (warehouse, trucking, expense) as separate places. A connected strip reads as one process, which VMB doesn't have. _Done when_ every visual claim in the brief points to a brand source or a domain term.
2. **Territory, chosen by the user.** Offer two or three style territories, each with a feeling, a motif and a reference image, and let the user pick one by name. A palette or font change is a design-system change: record it as an ADR next to ADR-0035 and ADR-0036. _Done when_ the user has named the territory and any token change has an ADR.
3. **Build the real screen with a stand-in.** Implement on the app's real route, keeping its form semantics, auth actions and tests. Use stand-in art to test the composition; Pen's `Generate("ai")` is fine for this. A stand-in never ships, because its usage rights are unverified. Rendering the real page is where layout, cropping and contrast problems show up. _Done when_ the screen renders at every review viewport (below) in light and dark with the stand-in.
4. **Production art in Recraft.** Estimate credits before each batch and log them after it. Generate two images per prompt, compare them on a contact sheet, pick one, and crisp-upscale it. Generate a separate image for each layer that must be placed or moved on its own (landscape, sky, flock). Vectorize logos. See _Recraft_ below. _Done when_ the chosen sources sit in the round's `sources/` folder and the round README logs prompts, picks and credits.
5. **Ship art as token-filled masks.** Convert each engraving with `docs/design/etched-login/prepare-etching.py` (`--help` lists trimming, side fades and sizes), then draw it with CSS `mask-image` over a colour token such as `--etching`. One file then serves light and dark, and the colour stays in the design system. Give each plate the aspect ratio of its trimmed file, so wide screens show the whole image instead of cropping its top. _Done when_ the build bundles the masks and the round README records their sizes.
6. **Verify with numbers.** Run `node apps/web/scripts/design-screenshots.mjs <url> <out-dir>` (review viewports × light/dark) and look at every capture. Measure contrast for each text pair, including text that sits near ornaments. Probe layout shift by inserting an element after each input, as a password manager would. _Done when_ every capture has been looked at, every _Rules_ item below holds, and the measurements are in the round README.
7. **Owner review in their own browser.** Ask the user to try the screen at their native size, with their extensions installed. In the pilot this caught two bugs the automated checks missed: a plate cropped at 1680px wide, and a password-manager icon that grew the form. Loop fixes back through step 6. _Done when_ the user confirms the screen.

**Review viewports:** 1920×1080, 1680×1000, 1440×900, 1366×768, 1024×923, 390×844.

## Rules

- **Ornaments frame text.** Keep a clear zone of at least 2.5rem around every line of text, and place art around the text rather than under it. Measured in the pilot: a line at a 20% ink wash leaves the 16px supporting text at 4.2:1, below the 4.5:1 minimum, and hatching through letters reads as a printing flaw.
- **The form is first.** It is usable before any art loads, and it keeps its layout whether or not the art loads at all. Every input sits in its own wrapper, so elements injected by extensions don't change the spacing.
- **Motion plays once.** Entrance motion settles and stops, so it needs no pause control (WCAG 2.2.2). Reduced motion shows the finished state. No ambient motion near a focused field. Feedback for the user's own action may play there once, within the motion tokens: a step's mark printed in when a code is sent, a check drawn when a code is confirmed, a toggle's icon changing.
- **Decorative art is `aria-hidden`.** Show extra layers only where there is room for them. In the pilot, the sky appears at 64rem and wider, and the flock only on screens at least 56rem tall.
- **Tokens only.** Art colours, washes and shadows come from `app.css` tokens (ADR-0035 rule 1). A new colour gets a new token in both `:root` and `.dark`.

## Skills

Checked 2026-10-06 against impeccable 4.5.0. Three design skill sets are installed per machine, and all three describe themselves as "improve this UI", so name the one you want instead of letting the model pick. Each has one job. All three defer to ADR-0035, ADR-0036, ADR-0040, `app.css` and the steps above.

| Skill set                                | Job                                                                                                                                                                                                               | Not for                                                                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **impeccable** (`/impeccable <command>`) | Leads a round: `init` (`PRODUCT.md`), `shape` (steps 1–2), the build in step 3, variants (`live`, `generate`), the refine passes (`polish`, `harden`, `distill`). Its hook runs a design detector after UI edits. | Final accessibility and contrast numbers (use interfaces). Production art: its asset-producer output is a decision comp, never shipped (step 4 is Recraft).             |
| **interfaces** (`/interfaces:better-*`)  | The exact-value check in step 6: `better-accessibility` (WCAG 2.2, ADR-0035 rule 6), `better-colors` (contrast, new tokens), `better-writing`. `build-design` turns a Pen image into Svelte on the real tokens.   | Choosing a direction.                                                                                                                                                   |
| **ui-ux-pro-max** (`/ui-ux-pro-max:*`)   | Off-app assets: banners, slides, social images, logo exploration. At most a catalogue to look up when proposing territories in step 2.                                                                            | VMB screens. Its `ui-styling` targets shadcn/ui on React, and catalogue picks are the generic route _Tried and dropped_ rules out. Disabled in `.claude/settings.json`. |

- **Brief it in Operate mode.** impeccable defaults to "go all out"; its rule that the brief wins only protects VMB when `PRODUCT.md` pins the app surfaces to its Operate mode and the chosen territory.
- **One check per concern.** In step 6, `better-*` owns accessibility, contrast and copy; don't also run `/impeccable audit`, `typeset` or `colorize` on the same pass. Finish with `/impeccable polish`.
- **`DESIGN.md` mirrors, it doesn't own.** `apps/web/DESIGN.md` gives impeccable the visual system without re-deriving it from CSS: a token header copied from `app.css` (the live panel draws its swatches from it) and short sections that point at the ADRs. `design-md.test.ts` fails when the header drifts from `app.css`. Change a token in `app.css` and its ADR first, then the header. Don't let `/impeccable document` rewrite the file.

## Tools

Checked 2026-09-28.

| Tool                    | Role                                                 | Cost and gotchas                                                                                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recraft** (MCP)       | Production art, upscaling, vectorizing               | Basic plan: $12 a month, or $10 a month billed yearly, for 1,000 credits that reset on the 28th. Paid plans grant commercial rights. V4.1 raster costs 2 credits, V4.1 Pro 10, crisp upscale 1, vectorize 1, erase region 1 (checked 2026-10-01). The pilot used 22 credits in total. |
| **Pen** (MCP)           | Stand-in art, quick layout studies, live-page import | Its HTML export is fixed-size presentational `div`s with no working inputs, so treat it as a visual reference only. SVG generation came back empty twice; raster generation works.                                                                                                    |
| **Playwright**          | Screenshots and layout probes                        | `apps/web/scripts/design-screenshots.mjs`. Reach for it when T3's preview snapshot fails: hidden preview tabs pause CSS animations. `--browser firefox` or `--browser webkit` renders the other engines (`pnpm exec playwright install firefox webkit` once).                         |
| **Rive** (desktop, CLI) | Reserve for art with real states or interaction      | A cheap, source-controlled `.riv` file, but exporting one for production needs the Cadet plan ($9 a seat a month, not bought). Dense engraving hatching doesn't suit vector animation.                                                                                                |

### Recraft

- **Connect** through the remote MCP `https://mcp.recraft.ai/mcp` (OAuth, user scope in Claude Code). It spends Studio subscription credits; the REST API would instead need separately bought API units.
- **Network:** the maintainer's office network resets TLS to Recraft's Cloudflare IPs (`104.26.6.194`, `104.26.7.194`, `172.67.75.83`). If `curl -I https://mcp.recraft.ai/mcp` doesn't return HTTP 401, switch networks.
- **Missing tools:** a session that started while the MCP was unreachable never gets its tools. A fresh headless process connects: `claude -p "<task>" --allowedTools "mcp__recraft__<tool>"`. Ask it to return image URLs as JSON, then download them with `curl`.
- **Image size:** results come back as signed URLs capped at 1536 × 768. For a production-size master, run `crisp_upscale` on the chosen image.
- **Prompting:** prompts alone on `recraftv4_1` gave consistent engraving; a custom style wasn't needed. State "on plain white paper", which parts of the frame stay empty, and exclusions (no text, border or dense dark areas). Ask for sparse art for layers that sit near text.
- **Masks:** `erase_region` and `inpaint_image` need a grayscale mask, but `request_upload_url` stores every upload as an RGB WebP, so a mask uploaded there is refused. Host the mask PNG elsewhere: a secret gist (pushed with git, since `gh gist create` refuses binaries) worked, deleted after use. Send a patch around the hole, not the whole master; results come back at the patch's size up to 1536px (`docs/design/etched-scenes/README.md`).
- **Logos:** enlarge small PNGs about 4× before `vectorize_image`. Then delete the background rectangle and the tracer's anti-alias fragments, and move the fills onto tokens.

## Tried and dropped

| Approach                                                            | Why it was dropped                                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| One long "act as a design team" prompt                              | It produced adjectives, not a direction. A brief built on brand evidence did better.                    |
| Isometric "crafted optimism" and still-life "quiet premium" studies | Generic logistics imagery, and a warehouse → truck → approval strip implied a process VMB doesn't have. |
| Pen HTML export as the handoff                                      | Presentational `div`s. The Svelte form stayed the implementation.                                       |
| Rive for the entrance                                               | A one-shot reveal is simpler in CSS, and the hand-built Rive art was weaker than the generated art.     |
| Guilloché rosette behind the form                                   | Its rings tangled with the sky's sun rays. It is kept in the history of PR #197.                        |
| Mirrored sky behind the headline                                    | It failed contrast for the supporting text and repeated the right-hand composition.                     |

## Turning this into a skill

Extract a skill only after a second screen has gone through these steps. The error page is that second screen (`docs/design/error-states/README.md`); once its owner review (step 7) is done, the skill can be drafted from what repeated across both rounds, not the auth pilot's particular choices. What repeated so far: one shared prompt frame with a swapped scene sentence, two images per prompt, masks through `prepare-etching.py`, and a ratio test per shipped mask.
