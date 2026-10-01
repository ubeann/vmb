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
| Tablet, mobile    | The vignette above the copy (at most 15rem tall, 10rem below 40rem), 2.5rem clear of the eyebrow. The page fits at 390 × 844 without scrolling.                                       |

The vignette box takes the art's own ratio and is never taller than `--vignette-max-height` (26rem on desktop), so the wide gate and the tall crates take the same room.

## Scenes and copy

The scene follows the status, never chance: the server and the browser draw the same picture, a refresh doesn't swap it, and tests and screenshots stay stable. `errorPageContent(status)` in `apps/web/src/lib/error-page.ts` holds the mapping.

| Status    | Scene          | Heading                  | Actions                      |
| --------- | -------------- | ------------------------ | ---------------------------- |
| 404, 410  | Road, signpost | Page not found           | Log in / Go to dashboard     |
| 401, 403  | Locked gate    | No access to this page   | Log in / Go to dashboard     |
| 5xx       | Toppled crates | Unable to load this page | Try again, then the way back |
| Other 4xx | Toppled crates | Unable to load this page | The way back                 |

The way back depends on the session: "Log in" (to `/login`) when signed out, "Go to dashboard" (to `/`) when signed in, read from `page.data.user`, which the root layout returns on every route. No value is passed in the URL. The labels follow the app's own terms ("Log in", not "login") and name the destination rather than "Back", which reads as the browser's Back button.

"Try again" reloads the same URL (`data-sveltekit-reload`), and the 5xx body names that button ("Try again, or come back in a few minutes.") so the page uses one word for one action. The heading says what failed ("Unable to load this page") instead of "Something went wrong".

An unexpected server failure also gets a short reference and its time from `handleError` in `hooks.server.ts`, both logged with the error. The page shows the reference as a read-only copy field, after the pattern of cloud consoles' account-ID fields: a "Reference" label, then a narrow bordered box (`--input` border, as the login fields) with the value in mono and a "Copy" button inside it. The button's accessible name is "Copy reference" (WCAG 2.5.3: it contains the visible word), since "Copy" alone says nothing in a screen reader's list of buttons. On success it reads "Copied" for 2 s with the animated check (ADR-0035 rule 3: motion for a confirmed copy), and a live region announces "Reference copied". When the clipboard is refused (a denied permission, a non-HTTPS page) the value is selected and the page says "Press ⌘C to copy the reference." (Ctrl+C off Apple devices), so there is always a next step. The button renders with the page, so nothing shifts on hydration. The value is not masked or blurred: a reference is not a secret. Below it: "If this keeps happening, email the support team at support@vmblogistics.id and include this reference." The link pre-fills the subject (`VMB error <reference>`) and a body with the reference, the page and the time in UTC, so support can find the log line without asking; the time comes from the server, so the server and the browser render the same link. A 404 gets no reference and no log line.

## Storyboard

| State          | Behaviour                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Arrival        | The copy and actions are ready at once. The vignette draws in once, left to right, like the login plate (1.6 s, after 150 ms). Then its parts move once and rest (#244). |
| Reduced motion | The vignette is shown finished: the truck gone, the gate shut and locked, the crates fallen.                                                                             |
| Dark           | The same masks filled with the dark `--etching`: the scene reads as a blueprint. Dense ink (the crates' doorway) turns into a pale block, as the landscape's shadows do. |

### Parts that move (#244)

Each part is a single iteration that ends at its natural style, which is its resting place; timings are motion tokens in `app.css`. Everything is at rest by 3.8 s. The vignette clips at its edge, so a leaf that swings or a crate that turns out of the plate is cut there; the truck fades out before it gets near it.

| Scene  | Part        | Motion                                                                                                                                            | Delay → end |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Road   | Truck       | Appears where it stood, waits a moment, then accelerates away to the left, fading as it goes. Gone at rest: the finished frame is the empty road. | 0.6 → 3.8 s |
| Gate   | Leaves      | Swing shut from open, each about its own hinge (`rotateY` from 78°, with `perspective` on the frame), settling softly.                            | 0.8 → 3.0 s |
| Gate   | Chain, lock | Drop onto the shut gate after the leaves have closed.                                                                                             | 3.0 → 3.3 s |
| Crates | Stack       | Stands upright and tips to its lean about its foot, overshooting a little (`--easing-arc`) before it settles.                                     | 0.9 → 3.1 s |
| Crates | Crate       | Falls from above the pile, turning about its base, and lands on the pile left of the stack.                                                       | 1.5 → 3.7 s |

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

The plates are `prepare-etching.py` masks of the 1216px sources, trimmed (`--trim --trim-x`) and written at one width, 840px (`--widths 840`): the vignettes draw at most about 30rem wide, so one size ships. `error-page.test.ts` fails when a ratio in `ERROR_SCENES` no longer matches its file. A page loads only its own scene's masks.

Each moving part is its own mask, placed on the plate from a manifest (`vmb-error-<scene>-parts.json`, each part's box in plate percentages; a turning part also has its `origin`). `motion.py` does the work around Recraft; see _Moving parts_ below.

```sh
python3 docs/design/error-states/motion.py patches   # only to resend a patch to Recraft
python3 docs/design/error-states/motion.py paste     # the filled sources, from Recraft's results
python3 docs/design/error-states/motion.py art       # the generated art, set on source-sized canvases
for scene in road:road-1 gate:gate-2 crates:crates-1; do
  python3 docs/design/etched-login/prepare-etching.py docs/design/error-states/sources/${scene#*:}-1216.jpg apps/web/src/lib/assets/errors \
    --name vmb-error-${scene%%:*} --trim --trim-x --widths 840 \
    --plate-source docs/design/error-states/sources/${scene%%:*}-filled.png \
    --parts docs/design/error-states/${scene%%:*}-parts.json \
    --manifest apps/web/src/lib/assets/errors/vmb-error-${scene%%:*}-parts.json
done
pnpm --dir apps/web exec prettier --write 'src/lib/assets/errors/*-parts.json'
```

Road 836 × 663, gate 838 × 397, crates 538 × 614 (the source's ink, before scaling to 840 wide).

## Moving parts (#244)

The parts are new Recraft art in the vignette style, set where the old part stood, and Recraft fills the holes the old parts leave. Opaque parts (truck, stack, crate) hide the plate behind them, as in `etched-scenes`: a `--background` backing through the mask's alpha, `--etching` through its luminance. The gate's leaves and lock are plain ink over the yard.

### Generation (1 Oct, 16 credits; 19 with the fills)

`recraftv4_1`, two images per prompt, 2 credits each (4 credits a prompt; balance 967 → 951). The shared frame is the vignettes' (above) with the scene sentence swapped in and "Nothing else: no ground, no shadow, no scenery, no people" so each part is alone on white paper.

| Part        | Aspect | Pick  | Why                                                                                                                                                     |
| ----------- | ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Truck       | 4:3    | **2** | The flat-nosed cab and the container behind it, seen front-left, are the approved truck's view. 1 is a rounded toy truck.                               |
| Gate leaf   | 1:2    | **1** | Two arched top rails that rise toward the meeting post, as the approved gate. 2 has one rail and a smaller finial. The right leaf is this one mirrored. |
| Crate stack | 2:3    | **1** | Slatted crates, as the source's. 2 is 22 flat trays with a cast shadow.                                                                                 |
| Crate       | 4:3    | **1** | Light, sparse slats that match the plate's line weight. 2 is darker, with a dense mesh that turns to a block at this size.                              |

`sources/motion/candidates-motion.jpg` shows all eight; the four picks are kept beside it. Prompts, with the shared frame (_Delicate 19th-century steel engraving, … No text, lettering, numbers, logos, signatures, borders or frames._) around them:

- **Truck:** A single heavy truck with a flat-nosed cab carrying one corrugated shipping container, seen from the front-left three-quarter view with the cab on the left and the container behind it on the right, three axles, rolling on wheels.
- **Gate leaf:** A single leaf of a tall wrought-iron yard gate, seen exactly straight-on from the front, hinged on its left edge: slim evenly spaced vertical iron bars topped with arrow-shaped spear finials, two gently curved horizontal rails along the top that rise from the left edge toward the right, a plain horizontal rail near the bottom, and a thicker upright meeting post along the right edge topped by a larger finial. Nothing else: no stone pillar, no fence, no chain, no padlock, no ground, no shadow, no yard or scenery behind it.
- **Crate stack:** A tall stack of about sixteen slatted wooden shipping crates piled neatly one on top of another, standing straight upright, seen from slightly above and from the front-left so the top crate's lid and the crates' side slats show. Nothing else: no warehouse, no ground, no shadow, no other crates, no pallet, no people.
- **Crate:** A single open-topped wooden shipping crate made of slats, empty, with a hand-hold cut-out in its side, seen from slightly above and from the front-left. Nothing else: no ground, no shadow, no other crates, no straw, no people.

### Placing the art

`motion.py art` sets each pick on a canvas the size of its source, and writes `<scene>-parts.json` for `prepare-etching.py --parts`:

- The art's ink is boxed ignoring Recraft's stray specks (a speck at the edge had made the first boxes too big and the art too small).
- The truck is scaled to 205 source pixels wide and stood on the road where the stopped truck was. The leaves are stretched to the leaf boxes between the pillars (the right leaf mirrored; their posts overlap at the middle, so the two read as one). The stack and crate are scaled and then turned about a pivot at their foot by the lean of the toppled art (stack 9°, crate −16°), and CSS turns them back about the same pivot (`origin` in the manifest) to start them upright.
- An opaque part's silhouette is the convex hull of its ink. The gate's lock (chain and padlock) is not generated: it is cut from the source where it hangs, as the leaves' ink alone would have left the gate unlocked.

### Filling the holes (1 Oct, 3 credits)

`motion.py patches` crops a 512 × 512 patch of each source around its holes and draws the mask: the old parts' outlines (traced by hand on the source), grown by 4px. Recraft's `erase_region` fills them (content-aware, no prompt, 1 credit a call) and `motion.py paste` sets each result back inside the mask Recraft was sent. Only the masks and results are kept (`sources/motion/fill/`); the patches and the filled sources are rebuilt from the sources. The balance went 951 → 948.

| Scene  | Patch                 | Hole                                 | Result                                                                                                                                                    |
| ------ | --------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Road   | (300, 360)–(812, 872) | The stopped truck                    | **Used.** The hills, the left bush and the road's hatching carry through where the truck stood.                                                           |
| Gate   | (330, 230)–(842, 742) | Both leaves and the lock             | **Used.** An open yard between the pillars with the ground fading out; the containers drawn behind the bars are gone, the fences either side keep theirs. |
| Crates | (360, 250)–(872, 762) | The leaning stack and the left crate | **Used.** The pile and the doorway are redrawn. The doorway's left half is a pale drape rather than the dark opening, which the stack hides at rest.      |

An attempt to thin the gate's mask to just the bars and rails failed: the bars are drawn as outlined double lines, so a stroke-width threshold caught only fragments. The mask is the whole leaf outline instead.

### Getting the masks to Recraft

As in #243, `request_upload_url` stores every upload as an RGB WebP, so a mask uploaded there is refused. The three mask PNGs went up as a secret GitHub gist (pushed with git, with `gh` as the credential helper for that one push), `erase_region` read them from their `gist.githubusercontent.com` raw URLs, and the gist was deleted straight after (its URLs answer 404). The patches went through `request_upload_url`; each upload took about two minutes from the office network, and the Recraft MCP session expired once in between and reconnected.

### Weight

Budget: at most 60 kB of moving-part art per page at each breakpoint (ADR-0040). One mask size ships, so a page's parts weigh the same at every breakpoint. Sizes are KiB, as `prepare-etching.py` prints them.

| Page   | Moving parts                             | Plate (before → after) |
| ------ | ---------------------------------------- | ---------------------- |
| Road   | **4.1 KiB**: truck 4.1                   | 60 → 55                |
| Gate   | **16.5 KiB**: leaves 7.8 + 7.6, lock 1.1 | 62 → 34                |
| Crates | **22.6 KiB**: stack 15.4, crate 7.2      | 107 → 89               |

The plates' sizes before are the single masks the first round shipped. **JS:** no motion code: the parts are CSS keyframes on the motion tokens, and the masks are imported with `?no-inline`, so the build emits each as a file. The three manifests, the mask-URL map and `partMask` do add a little to the error route's chunk, which is not measured here.

## Checked

- `design-screenshots.mjs` at every review viewport, light and dark, for 404, 403 and 500 (the last two through a local route that threw them, not committed): every capture fits without scrolling. Opened by eye: 1440 × 900 for all three in both schemes, 1366 × 768 (403, light), 1024 × 923 (403, dark), 390 × 844 (404 dark, 500 light). `sources/review-1440x900.jpg` and `sources/review-390x844.jpg` are the sheets.
- Clear zone: the art never sits under text; the gap is 4rem on desktop and 2.5rem stacked. The text colours are the existing tokens, measured in the login round (`--muted-foreground` 5.99:1 light, 8.45:1 dark).
- `AuthShell` after the header and footer moved into `SiteHeader` and `SiteFooter`: `/login` is pixel-identical to before at 1440 × 900, 1024 × 923 and 390 × 844 (reduced motion).
- `pnpm typecheck`, `pnpm lint` and `pnpm test` in `apps/web`.
- After the copy review (`interfaces:better-writing`) and the copy field: the 500 page at 1440 × 900 (light, and dark after a real copy in Chromium, which put the reference on the clipboard) and 390 × 844 (light), looked at by eye. It measures 844, 768, 923 and 900px tall at 390 × 844, 1366 × 768, 1024 × 923 and 1440 × 900, so it still fits; the field's extra row was paid for on mobile with a 10rem vignette and 2rem page padding. The signed-in "Go to dashboard" button and the blocked-clipboard hint are covered by component tests only.
- Motion (#244): frames of every scene at 0–4.2 s every 0.6 s, at 1440 × 900 (light, dark) and 390 × 844, by pausing every animation at set times. `error-page.test.ts` checks every part's box, mask size, ratio and pivot against its manifest; `etched-vignette.svelte.test.ts` renders each scene in Chromium and checks that every part is drawn and comes to rest at its box, that every inked layer is drawn through its art, that every part plays once and ends within 4 s (3.8 s at most), that reduced motion leaves no running animation, that the road's truck is gone from the finished frame, and that the lock drops after the leaves are shut.

## Review (#260, 1 Oct)

Playwright's Chromium, Firefox and WebKit against `vite dev` and a production build on `wrangler pages dev`. 403 and 500 came through a local route that threw them (not committed).

- **Captures:** `design-screenshots.mjs` at all six review viewports, light and dark, for 404, 403 and 500 in Chromium (`sources/review-260-404.jpg`, `-403.jpg`, `-500.jpg`; rows are light and dark, columns 1920 × 1080 to 390 × 844). Firefox and WebKit were captured the same way and compared with Chromium: 0.2–1.3% of pixels differ by more than 60 levels at the 403 and 404, and 0.3–2.1% at the 500, where the reference is random and wraps differently.
- **Fit:** every page fits without scrolling at all six viewports, light and dark, including 390 × 844 and 1366 × 768.
- **Clear zones with the parts moving:** the part boxes and the copy's boxes, sampled every 50 ms for 4.6 s. The nearest approach is 48 px at 390 × 844 (the gate's left leaf, at 0.8 s; the zone is 2.5rem = 40px) and 74 px or more at 1366 × 768 and 1440 × 900 (the zone is 4rem = 64px). These are box gaps, so they under-state the clearance of the ink.
- **`mask-mode: luminance` in Firefox and WebKit: works.** All three vignettes settle at the same boxes, with the same animations finishing in each engine (2, 4 and 3 for 404, 403 and 500). Real Safari is still to be looked at.
- **200% zoom:** at 720 × 450 and 683 × 384 (200% of 1440 × 900 and 1366 × 768) and at 320 × 256 (400%), no page scrolls sideways; the copy reflows under the vignette. The accessibility tree reads: banner, the `alert` with the level-1 heading and the line, the actions, the reference field with a labelled Copy button, the support link, and the footer. The vignette is not in it.

## Not yet checked

- **For owner review:** the generated truck, leaves, stack and crate are drawn in a cleaner, more regular hand than the approved plates, since Recraft draws each one alone; and whether the gate's lost container backdrop and the crates' pale drape in the doorway matter.
- A real 500 on Cloudflare Pages, and that its reference shows up in the Pages logs.
- A screen reader (VoiceOver, NVDA) reading the page. The accessibility tree above looks right, but nobody has listened to it.
- Owner review in a real browser (step 7), and a real Safari.
