# Etched scenes — design round

The auth plates' parts move once, then rest (#243, the first half of #235): the trucks roll onto the bridge, the crane lowers a container, the cloud bank drifts in, the seabirds arc in from the right, and light crosses the water. The pipeline is ADR-0040's: per-part raster ink masks, cut from the approved plates, animated with CSS keyframes. There is no new motion JS. This is the third round through the [design workflow](../../agents/design-workflow.md), after [etched login](../etched-login/README.md) (whose plates it splits) and [error states](../error-states/README.md).

## Storyboard

Everything plays from the server-rendered HTML, before hydration, and is at rest by 3.9 s. Timings are motion tokens in `app.css` (#242).

| Part       | Breakpoints         | Motion                                                                                                                                      | Delay → end   |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Plate      | all                 | Unchanged: the press-roller reveal.                                                                                                         | 0.15 → 1.75 s |
| Trucks     | all                 | The convoy rolls in from the left, a tenth of the plate's width, and stops. The lead truck (right) moves first, 120 ms ahead of each other. | 0.8 → 3.24 s  |
| Container  | all                 | Fades in at the boom's end and is lowered onto the yard's stacks, on two engraved wire ropes that pay out from the boom.                    | 1.2 → 3.4 s   |
| Water      | all                 | A soft band crosses the water under the bridge and strengthens its hatching as it passes. At rest the band is past the edge.                | 2.2 → 3.8 s   |
| Sky        | ≥ 64rem             | Unchanged: fades in and settles 2.5rem to the left.                                                                                         | 0.9 → 3.3 s   |
| Cloud bank | ≥ 64rem             | Two pieces drift 6rem in from the right, further than the sky itself, so the bank moves across it.                                          | 0.9 → 3.42 s  |
| Seabirds   | ≥ 64rem             | Glide in 10rem from the right while rising past their place and sinking back (`--easing-arc` on a second property), so the path is an arc.  | 1.1 → 3.86 s  |
| Left flock | ≥ 64rem, 56rem tall | Unchanged: fades in and settles.                                                                                                            | 1.3 → 3.7 s   |

Each part is a single iteration that ends at its natural style, which is its resting place. Reduced motion sets `animation: none` on every part on top of the global rule, so the finished frame shows at once. Moving between `/login` and `/activate` doesn't replay anything, because `AuthShell` stays mounted (#230). `sources/motion-243.jpg` shows frames at 0.6, 1.4, 2.2, 3.0 and 4.0 s at 1440 × 900 (light, dark) and 390 × 844.

## Splitting the art

Every moving part is a polygon in the source's pixels: `landscape-parts.json` for the landscape master, `sky-parts.json` for the sky. `prepare-etching.py` now replays the plate's own steps (trim, crop, flip, fades, padding) on each part, so a part lines up with the plate exactly, and writes a manifest beside the masks with each part's box at rest in plate percentages (`vmb-etching-parts.json`, `vmb-sky-parts.json`). The components import the manifests, so the positions have one source.

- **Opaque parts** (trucks, container) hide the plate behind them, as the art did before the cut. Their file keeps the ink as white luminance and the part's silhouette in alpha. CSS draws a `--background` backing through the alpha, then `--etching` through the luminance (`mask-mode`). So one file per size, and at rest each part looks as it did in the original art.
- **The trucks** are cut down to y 1521, so they keep their whole tyres. In the master the tyres sink into the deck's dark band (y 1514–1530); the first cut stopped at its top edge, which left the paper strip under each chassis reading as a gap above the deck (owner review).
- **The container and its ropes** are new Recraft art (below), set on master-sized canvases by `hoist.py` and given to `prepare-etching.py` as each part's `"art"`, so they go through the plate's steps like everything else. The container comes to rest 107 source pixels below the boom's end, where the cut container sat (`"rest"` in the parts file). The manifest records the drop as the CSS `translate` it starts from. The ropes run from the boom's underside to the container's resting top, and are uncovered from the boom down (`clip-path`) on the container's timing. The container sits 26 source pixels further in than the cut one did: the boom ends at x 3167, and the cut container overhung it, so its outer rope hung from nothing (owner review). Now the outer rope drops from just inside the boom's tip. The first version used the container cut from the plate and two 1px CSS lines for cables; the owner found the lines didn't match the engraving.
- **The water** is an overlay: it isn't cut out of the plate, and it keeps its ink at full strength through the plate's bottom fade. The sweep only shows where the band is. Its polygon reaches around the palms by the left-hand pier, above and beside them; the first one stopped short of them, so the light crossed only three quarters of the water (owner review).
- **Clouds and birds** sit on bare paper, so they are cut out of the sky with no fill.

The first sky cut took the two small clouds at the top of the art. They sit in rows 0–30%, which the sky's `right 60%` crop and its masthead fade hide at every desktop size, so they moved where no one could see them. The cut now takes the large bank (rows 25–60%), split where the sun's rays don't cross it.

`EtchedSky` used to crop its art with `mask-size: cover` at `right 60%`. It now builds that crop as a box in container-query units (`--sky-ratio`), so the parts can be placed in the art's percentages. The masthead and headline fades stay on the outer element and apply to every layer.

## Recraft (1 Oct, 6 credits)

### Filling the holes

`fill-holes.py patches` crops a patch of the 4096px master around each hole and draws its mask: the parts' polygons, grown by 6px. Recraft's `erase_region` (content-aware, no prompt) fills them, and `fill-holes.py paste` sets each result back into the master inside the mask Recraft was sent, softened by 2px. It reads the saved mask, so a later change to a part's cut (such as the trucks' tyres) doesn't move the fill. Everything outside the masks keeps the master's pixels. Only the results and masks are kept here (`sources/fill/`); the patches and the filled master are rebuilt from the master.

| Call           | Patch                | Credits | Result                                                                                                                                                                 |
| -------------- | -------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `erase_region` | trucks, 1536 × 512   | 1       | **Used.** The deck's top rail and the yard hatching behind the right-hand truck carry through. A faint grey smudge is left on the deck, too small to see on the plate. |
| `erase_region` | container, 512 × 512 | 1       | **Used.** The boom's end and its railing are redrawn where the container sat.                                                                                          |

The balance went 973 → 971. **`erase_region` costs 1 credit per call**, which the motion research had left unverified. Both results came back at the input's size, so patches up to 1536px wide keep the master's resolution.

### The container and its ropes

`recraftv4_1`, 1:2, two images, 4 credits (971 → 967). The prompt:

> Delicate 19th-century steel engraving, fine cross-hatching, thin black ink lines on plain white paper, monochrome. A single twenty-foot shipping container with vertical corrugated ribs, seen exactly side-on, hanging perfectly level under a slim crane spreader frame on two taut vertical steel wire ropes, one near each end, that run straight up to the top edge of the image. The container sits in the bottom third of the image; above it only the two thin ropes. Nothing else: no crane, no ground, no water, no shadow, no sky, no people. Even, light line weight like a museum-quality landscape engraving, clean outline, open white paper around it. No text, lettering, numbers, logos, signatures, borders or frames.

| Pick  | Why                                                                                                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | V-slings from a ring to the corners read most like real rigging, but at the cut container's width the slings are about 80 of the 108 source pixels between the boom and the stacks, so the container would drop only about 26. |
| **2** | Ropes straight to the corners: the container keeps the full drop, and the ropes fit the existing pay-out. Each rope is two hairline strands, which scale to almost nothing, so `hoist.py` grows their ink by 5px first.        |

Both are in `sources/hoist/`. At the plate's scale the container is about 40px wide on screen and the ropes about 2px, so they take the plate's own line weight: quieter than the CSS lines were, and they merge with the crane's hatching behind them.

### Getting the mask to Recraft

The MCP's `request_upload_url` stores every upload as an RGB WebP, even a grayscale PNG or JPEG. `erase_region` then rejects it ("Mask must be a grayscale image"); those refusals cost nothing. The masks went up instead as a secret GitHub gist (pushed with git, since `gh gist create` refuses binary files). `erase_region` read them from their `gist.githubusercontent.com` raw URLs, and the gist was deleted straight after. The patch itself went through `request_upload_url` as usual.

## Rebuilding

```sh
python3 docs/design/etched-scenes/fill-holes.py patches   # only to resend a patch to Recraft
python3 docs/design/etched-scenes/fill-holes.py paste
python3 docs/design/etched-scenes/hoist.py
python3 docs/design/etched-login/prepare-etching.py docs/design/etched-login/sources/landscape-a1-4096.jpg apps/web/src/lib/assets/auth --trim --trim-x --crop-bottom 0.08 --flip --fade-sides 0.06 --fade-bottom 0.30 --pad-to 5 --plate-source docs/design/etched-scenes/sources/landscape-a1-4096-filled.png --parts docs/design/etched-scenes/landscape-parts.json --manifest apps/web/src/lib/assets/auth/vmb-etching-parts.json
python3 docs/design/etched-login/prepare-etching.py docs/design/etched-login/sources/sky-2-1536.jpg apps/web/src/lib/assets/auth --name vmb-sky --parts docs/design/etched-scenes/sky-parts.json --manifest apps/web/src/lib/assets/auth/vmb-sky-parts.json
pnpm --dir apps/web exec prettier --write src/lib/assets/auth/*-parts.json
```

Without `--parts`, the script's output is byte-identical to before for the landscape (checked against the shipped files). `etched-scene.test.ts` fails when a manifest, a plate and its part masks don't come from the same run.

## Weight

The art budget is at most 60 kB of moving parts per page, at each breakpoint (ADR-0040). Sizes are KiB, as `prepare-etching.py` prints them (desktop parts are 42.7 kB in decimal units).

| Breakpoint        | Moving parts                                                                             | Plates (before → after)                  | Net art change |
| ----------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- | -------------- |
| Desktop (≥ 64rem) | **41.7 kB**: trucks 9.4, container 0.6, ropes 0.4, water 4.2, cloud bank 24.7, birds 2.3 | landscape 163.1 → 154.6, sky 54.3 → 28.6 | +7.5 kB        |
| Tablet, mobile    | **4.4 kB**: trucks 2.9, container 0.2, ropes 0.2, water 1.1 (no sky)                     | landscape 42.5 → 40.3                    | +2.2 kB        |

The plates got lighter because the filled holes and the cut sky parts hold less ink. Vite would inline any mask under 4 kB into the JS as a data URL, so the components import the masks with `?no-inline`; the build emits every mask as its own file.

**JS.** No motion code: the parts are CSS keyframes. The `(auth)` layout's chunk grows from 3.5 to 9.0 kB raw, **1.6 → 3.2 kB gzipped (+1.6 kB)**, for the mask URLs, the two manifests and the extra markup (`vite build`, compared with `master` at `0e5605b`).

## Checked

- `pnpm typecheck`, `pnpm lint` and `pnpm test` in `apps/web` (40 files, 332 tests). `etched-scene.test.ts` checks every part mask against its manifest box at both sizes, keeps parts inside the plate, keeps the trucks on one baseline, lowers the container from above, and keeps the water under the trucks. `etched-scene.svelte.test.ts` renders both components in Chromium. It checks that every manifest part is drawn and comes to rest at its box. It checks that every inked layer is drawn through its art: a broken mask once filled the whole band with ink, and the test was written red against that bug. It also checks that every part plays once and ends within 4 s, and that reduced motion leaves no running animation.
- `design-screenshots.mjs` at every review viewport, light and dark (`sources/review-243.jpg`). The finished frame matches the earlier plates. 1366 × 768 scrolls to 773px and 390 × 844 to 960px; hiding every moving part doesn't change either height.
- The crane, the wheels on the deck and the water were checked frame by frame, by pausing every animation at set times, and the ropes against the committed CSS cables at 1920 × 1080, light and dark.

**Clear zones, measured** with Playwright every 50 ms, against the glyph boxes of the brand line and its supporting line and the form sheet's box. Only the parts of each layer that the sky's fades leave at least 10% visible count.

| Viewport    | Seabirds to text | Seabirds 3–4 to sheet | Seabirds 1–2, cloud bank                                             |
| ----------- | ---------------- | --------------------- | -------------------------------------------------------------------- |
| 1920 × 1080 | ≥ 430px          | ≥ 259px               | pass behind the sheet; the bank's right piece comes within 8px of it |
| 1680 × 1000 | ≥ 382px          | ≥ 155px               | pass behind the sheet                                                |
| 1440 × 900  | ≥ 333px          | ≥ 50px                | pass behind the sheet                                                |
| 1366 × 768  | ≥ 318px          | 18px (bird 4)         | pass behind the sheet                                                |
| 1024 × 923  | ≥ 297px          | behind the sheet      | pass behind the sheet                                                |

The birds keep well clear of the text. The right-hand sky, though, mostly lies behind the form sheet on desktops narrower than about 1500px, so parts move behind the sheet and close to its edge, as the whole sky's settle already did. The cloud bank's faint left wisps are within the headline's glyph box by up to 23px at rest; they were there before this round, and the bank drifts in from the right, away from the text. **For owner review:** whether motion behind and beside the sheet meets "nothing moves near the form".

## Review (#260, 1 Oct)

Run against `vite dev` and a production build served by `wrangler pages dev`, with Playwright's Chromium, Firefox and WebKit builds. `design-screenshots.mjs` now takes `--browser chromium|firefox|webkit` and sets the page's colour scheme, as a few dark captures had come out light when hydration reset the class.

- **`mask-mode: luminance` in Firefox and WebKit: works.** `/login` and `/activate` settled in all three engines at every review viewport, light and dark. Against Chromium, 0.3–1.0% of pixels differ by more than 60 levels (text anti-aliasing). The opaque trucks and container, the backing and the ink all draw, and the same 19 animations run and finish within 4.4 s in each engine. `sources/browsers-260.jpg` shows 1440 × 900. Playwright's WebKit is the engine Safari uses, not Safari: a real Safari (macOS and iOS) is still to be looked at.
- **`/activate` matches `/login`.** At 1920 × 1080, 1440 × 900 and 1024 × 923 the scene band is pixel-identical in Chromium and Firefox. At 1366 × 768 and 390 × 844 the pages differ in height (the activate form is taller), so the bands sit at different offsets. Moving between them by link keeps the same scene nodes, and every scene animation stays `finished`. The only animations that run are the auth card's view transition.
- **Slow connection: the plate does not paint first.** On the live site (HTTP/2) throttled to Slow 4G (1.6 Mbit/s, 150 ms), the parts arrive between 1.8 and 2.5 s and the 159 kB plate at 3.4 s. On Fast 3G the plate lands at 4.7 s, after the parts. In between, the trucks, the container and the sky's birds and clouds hang on bare paper (`sources/throttle-260.jpg`). On mobile the gap is smaller (parts 1.4 s, plate 2.1 s). The form is unaffected: it is usable from the first paint. The requests are separate files as designed (12 at desktop, 6 below), but the browser finds the plate no earlier than the parts, and the biggest file finishes last. A `<link rel="preload" as="image" crossorigin>` for the plate downloads it once, but on the local HTTP/1.1 server it still finished after the parts, which says nothing about Cloudflare's HTTP/2, so it was not kept. **Open:** decide how to order the art (see the ticket).

## Not yet checked

- Owner review in their own browser (step 7), including whether motion behind and beside the form sheet below ~1500px is acceptable.
- A real Safari, on macOS and iOS (Playwright's WebKit passed).
