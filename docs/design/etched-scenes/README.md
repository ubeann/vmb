# Etched scenes — design round

The auth plates' parts move once, then rest (#243, the first half of #235): the trucks roll onto the bridge, the crane lowers a container, the cloud bank drifts in, the seabirds arc in from the right, and light crosses the water. The pipeline is ADR-0040's: per-part raster ink masks, cut from the approved plates, animated with CSS keyframes. There is no new motion JS. This is the third round through the [design workflow](../../agents/design-workflow.md), after [etched login](../etched-login/README.md) (whose plates it splits) and [error states](../error-states/README.md).

## Storyboard

Everything plays from the server-rendered HTML, before hydration, and is at rest by 3.9 s. Timings are motion tokens in `app.css` (#242).

| Part       | Breakpoints         | Motion                                                                                                                                      | Delay → end   |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Plate      | all                 | Unchanged: the press-roller reveal.                                                                                                         | 0.15 → 1.75 s |
| Trucks     | all                 | The convoy rolls in from the left, a tenth of the plate's width, and stops. The lead truck (right) moves first, 120 ms ahead of each other. | 0.8 → 3.24 s  |
| Container  | all                 | Fades in at the boom's end and is lowered onto the yard's stacks, on two cables that pay out from the boom.                                 | 1.2 → 3.4 s   |
| Water      | all                 | A soft band crosses the water under the bridge and strengthens its hatching as it passes. At rest the band is past the edge.                | 2.2 → 3.8 s   |
| Sky        | ≥ 64rem             | Unchanged: fades in and settles 2.5rem to the left.                                                                                         | 0.9 → 3.3 s   |
| Cloud bank | ≥ 64rem             | Two pieces drift 6rem in from the right, further than the sky itself, so the bank moves across it.                                          | 0.9 → 3.42 s  |
| Seabirds   | ≥ 64rem             | Glide in 10rem from the right while rising past their place and sinking back (`--easing-arc` on a second property), so the path is an arc.  | 1.1 → 3.86 s  |
| Left flock | ≥ 64rem, 56rem tall | Unchanged: fades in and settles.                                                                                                            | 1.3 → 3.7 s   |

Each part is a single iteration that ends at its natural style, which is its resting place. Reduced motion sets `animation: none` on every part on top of the global rule, so the finished frame shows at once. Moving between `/login` and `/activate` doesn't replay anything, because `AuthShell` stays mounted (#230). `sources/motion-243.jpg` shows frames at 0.6, 1.4, 2.2, 3.0 and 4.0 s at 1440 × 900 (light, dark) and 390 × 844.

## Splitting the art

Every moving part is a polygon in the source's pixels: `landscape-parts.json` for the landscape master, `sky-parts.json` for the sky. `prepare-etching.py` now replays the plate's own steps (trim, crop, flip, fades, padding) on each part, so a part lines up with the plate exactly, and writes a manifest beside the masks with each part's box at rest in plate percentages (`vmb-etching-parts.json`, `vmb-sky-parts.json`). The components import the manifests, so the positions have one source.

- **Opaque parts** (trucks, container) hide the plate behind them, as the art did before the cut. Their file keeps the ink as white luminance and the part's silhouette in alpha. CSS draws a `--background` backing through the alpha, then `--etching` through the luminance (`mask-mode`). So one file per size, and at rest each part looks as it did in the original art.
- **The container** comes to rest 108 source pixels below where it was cut (`"rest"` in the parts file). The manifest records the drop as the CSS `translate` it starts from. Two cables, 1px `--etching` lines drawn in CSS, hang from the boom to its resting top; they are the one piece of new art, and stay in the finished frame, so the container doesn't look dropped. No Recraft layer was needed for two straight lines.
- **The water** is an overlay: it isn't cut out of the plate, and it keeps its ink at full strength through the plate's bottom fade. The sweep only shows where the band is.
- **Clouds and birds** sit on bare paper, so they are cut out of the sky with no fill.

The first sky cut took the two small clouds at the top of the art. They sit in rows 0–30%, which the sky's `right 60%` crop and its masthead fade hide at every desktop size, so they moved where no one could see them. The cut now takes the large bank (rows 25–60%), split where the sun's rays don't cross it.

`EtchedSky` used to crop its art with `mask-size: cover` at `right 60%`. It now builds that crop as a box in container-query units (`--sky-ratio`), so the parts can be placed in the art's percentages. The masthead and headline fades stay on the outer element and apply to every layer.

## Filling the holes (Recraft, 1 Oct, 2 credits)

`fill-holes.py patches` crops a patch of the 4096px master around each hole and draws its mask: the parts' polygons, grown by 6px. Recraft's `erase_region` (content-aware, no prompt) fills them, and `fill-holes.py paste` sets each result back into the master inside its mask, softened by 2px. Everything outside the masks keeps the master's pixels. Only the results and masks are kept here (`sources/fill/`); the patches and the filled master are rebuilt from the master.

| Call           | Patch                | Credits | Result                                                                                                                                                                 |
| -------------- | -------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `erase_region` | trucks, 1536 × 512   | 1       | **Used.** The deck's top rail and the yard hatching behind the right-hand truck carry through. A faint grey smudge is left on the deck, too small to see on the plate. |
| `erase_region` | container, 512 × 512 | 1       | **Used.** The boom's end and its railing are redrawn where the container sat.                                                                                          |

The balance went 973 → 971. **`erase_region` costs 1 credit per call**, which the motion research had left unverified. Both results came back at the input's size, so patches up to 1536px wide keep the master's resolution.

**Getting the mask to Recraft.** The MCP's `request_upload_url` stores every upload as an RGB WebP, even a grayscale PNG or JPEG. `erase_region` then rejects it ("Mask must be a grayscale image"); those refusals cost nothing. The masks went up instead as a secret GitHub gist (pushed with git, since `gh gist create` refuses binary files). `erase_region` read them from their `gist.githubusercontent.com` raw URLs, and the gist was deleted straight after. The patch itself went through `request_upload_url` as usual.

## Rebuilding

```sh
python3 docs/design/etched-scenes/fill-holes.py patches   # only to resend a patch to Recraft
python3 docs/design/etched-scenes/fill-holes.py paste
python3 docs/design/etched-login/prepare-etching.py docs/design/etched-login/sources/landscape-a1-4096.jpg apps/web/src/lib/assets/auth --trim --trim-x --crop-bottom 0.08 --flip --fade-sides 0.06 --fade-bottom 0.30 --pad-to 5 --plate-source docs/design/etched-scenes/sources/landscape-a1-4096-filled.png --parts docs/design/etched-scenes/landscape-parts.json --manifest apps/web/src/lib/assets/auth/vmb-etching-parts.json
python3 docs/design/etched-login/prepare-etching.py docs/design/etched-login/sources/sky-2-1536.jpg apps/web/src/lib/assets/auth --name vmb-sky --parts docs/design/etched-scenes/sky-parts.json --manifest apps/web/src/lib/assets/auth/vmb-sky-parts.json
pnpm --dir apps/web exec prettier --write src/lib/assets/auth/*-parts.json
```

Without `--parts`, the script's output is byte-identical to before for the landscape (checked against the shipped files). `etched-scene.test.ts` fails when a manifest, a plate and its part masks don't come from the same run.

## Weight

The art budget is at most 60 kB of moving parts per page, at each breakpoint (ADR-0040). Sizes are KiB, as `prepare-etching.py` prints them (desktop parts are 41.5 kB in decimal units).

| Breakpoint        | Moving parts                                                                  | Plates (before → after)                  | Net art change |
| ----------------- | ----------------------------------------------------------------------------- | ---------------------------------------- | -------------- |
| Desktop (≥ 64rem) | **40.5 kB**: trucks 9.0, container 0.8, water 3.7, cloud bank 24.7, birds 2.3 | landscape 163.1 → 154.6, sky 54.3 → 28.6 | +6.3 kB        |
| Tablet, mobile    | **3.8 kB**: trucks 2.6, container 0.2, water 1.0 (no sky)                     | landscape 42.5 → 40.3                    | +1.6 kB        |

The plates got lighter because the filled holes and the cut sky parts hold less ink. Vite would inline any mask under 4 kB into the JS as a data URL, so the components import the masks with `?no-inline`; the build emits every mask as its own file.

**JS.** No motion code: the parts are CSS keyframes. The `(auth)` layout's chunk grows from 3.5 to 9.0 kB raw, **1.6 → 3.2 kB gzipped (+1.6 kB)**, for the mask URLs, the two manifests and the extra markup (`vite build`, compared with `master` at `0e5605b`).

## Checked

- `pnpm typecheck`, `pnpm lint` and `pnpm test` in `apps/web` (40 files, 329 tests). `etched-scene.test.ts` checks every part mask against its manifest box at both sizes, keeps parts inside the plate, keeps the trucks on one baseline, lowers the container from above, and keeps the water under the trucks. `etched-scene.svelte.test.ts` renders both components in Chromium. It checks that every manifest part is drawn and comes to rest at its box. It checks that every inked layer is drawn through its art: a broken mask once filled the whole band with ink, and the test was written red against that bug. It also checks that every part plays once and ends within 4 s, and that reduced motion leaves no running animation.
- `design-screenshots.mjs` at every review viewport, light and dark (`sources/review-243.jpg`). The finished frame matches the earlier plates. 1366 × 768 scrolls to 773px and 390 × 844 to 960px; hiding every moving part doesn't change either height.
- The crane and the water were checked frame by frame, by pausing every animation at set times.

**Clear zones, measured** with Playwright every 50 ms, against the glyph boxes of the brand line and its supporting line and the form sheet's box. Only the parts of each layer that the sky's fades leave at least 10% visible count.

| Viewport    | Seabirds to text | Seabirds 3–4 to sheet | Seabirds 1–2, cloud bank                                             |
| ----------- | ---------------- | --------------------- | -------------------------------------------------------------------- |
| 1920 × 1080 | ≥ 430px          | ≥ 259px               | pass behind the sheet; the bank's right piece comes within 8px of it |
| 1680 × 1000 | ≥ 382px          | ≥ 155px               | pass behind the sheet                                                |
| 1440 × 900  | ≥ 333px          | ≥ 50px                | pass behind the sheet                                                |
| 1366 × 768  | ≥ 318px          | 18px (bird 4)         | pass behind the sheet                                                |
| 1024 × 923  | ≥ 297px          | behind the sheet      | pass behind the sheet                                                |

The birds keep well clear of the text. The right-hand sky, though, mostly lies behind the form sheet on desktops narrower than about 1500px, so parts move behind the sheet and close to its edge, as the whole sky's settle already did. The cloud bank's faint left wisps are within the headline's glyph box by up to 23px at rest; they were there before this round, and the bank drifts in from the right, away from the text. **For owner review:** whether motion behind and beside the sheet meets "nothing moves near the form".

## Not yet checked

- Owner review in their own browser (step 7).
- The activate page; it shares `AuthShell`, so it should match `/login`.
- Real-device timing on a slow connection: the parts are separate requests (11 at desktop, 5 below).
- `mask-mode: luminance` on Safari and Firefox. Both list support, but only Chromium was rendered.
