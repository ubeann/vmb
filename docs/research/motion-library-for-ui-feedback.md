# Motion library for UI feedback and transitions: CSS and Svelte built-ins, View Transitions, Motion, GSAP, Rive, Lottie

Research date: **2026-09-30** (all pages, npm registry entries and package sources accessed or installed on this date, unless a line says otherwise). Sources are primary: official docs, licence pages, package source from npm, and the W3C/WebDX feature data. Repo facts cite `path:line` in this worktree. Issue #210, with context from #175, #177, #230 and #235.

**How sizes were measured.** Each package was installed into a scratch directory outside the repo and bundled with `esbuild 0.28.2 --bundle --minify --format=esm --platform=browser`. The entry imports only what a scene would use. Sizes are `gzip -9` and `brotli -q 11` of that output, in kB (1 kB = 1,000 bytes). WASM files were compressed the same way. The app's own baseline comes from a production `vite build` of `apps/web`, adding up the JS chunks that the Vite manifest says a route loads. The build output and `node_modules` were deleted afterwards.

Legend: **UNVERIFIED** = could not be confirmed from a primary source, and not guessed. _(inference)_ = reasoning from cited facts.

**TL;DR**

| Question                             | Answer                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Built-ins plus CSS enough?           | **Yes, for everything on record.** That covers UI feedback, card and route transitions, list changes and the one-shot etched scenes. The repo already does all of these without a library.                                                                                                                                                                                              |
| Motion (motion.dev)                  | MIT. Vanilla `animate()` is 3.9 kB gz (mini) or 20.2 kB gz (hybrid). It does **not** honour reduced motion by default on plain elements (tested). This is the first thing to reach for _if_ a JS need appears. Nothing needs it today.                                                                                                                                                  |
| GSAP                                 | Free for commercial use since 2025-04-30, plugins included. It is **not open source**: the "Standard 'no charge' license" belongs to Webflow, which "reserves the right to update or modify" it at any time. Core is 27.6 kB gz. Not needed.                                                                                                                                            |
| Rive (`@rive-app/canvas` and family) | The runtime is MIT, imports without errors under SSR, and works from Svelte without a wrapper. It costs 49.5–57.8 kB gz of JS **plus 279–717 kB brotli of WASM**, fetched from unpkg unless self-hosted. It draws to a canvas, so the `--etching` CSS-mask colouring does not carry over. It still needs the same per-part art split. Exporting needs the Cadet plan. **Not for #235.** |
| Lottie                               | lottie-web is 48.9–78.7 kB gz and its last release was 2025-05. dotLottie adds 388 kB brotli of WASM. It needs After Effects-style authoring. **No.**                                                                                                                                                                                                                                   |
| Etched scenes (#235)                 | **Per-part raster ink masks animated with CSS keyframes.** No new JS. About 3–11 kB of WebP per moving part (measured). The hard part is splitting the art and filling the holes, and every option has to pay for that.                                                                                                                                                                 |
| Hosting                              | `apps/web` is on **Cloudflare Pages**, as the ticket says. ADR-0009 only says "Pages + Workers", so nothing conflicts.                                                                                                                                                                                                                                                                  |

---

## 0. How the repo moves today (the baseline)

- **The reduced-motion contract.**
  - ADR-0035 rule 6 (`docs/adr/0035-tailwind-and-shadcn-svelte-design-system.md:18`) splits reduced motion into two halves.
  - CSS `animation`/`transition` are collapsed globally (`apps/web/src/app.css:179-190`: `0.01ms`, one iteration).
  - Svelte transitions, `Tween`/`Spring`, JS libraries ("Motion, Lottie, Rive") and View Transitions must read `prefersReducedMotion` from `svelte/motion` themselves.
  - Loading indicators always carry text. #175 (closed) added this.
- **Design rules.** `docs/agents/design-workflow.md:23`: "Motion plays once… Reduced motion shows the finished state. Nothing moves near a focused field." Rive is listed as "Reserve for art with real states or interaction" and needs the Cadet plan to export. "Rive for the entrance" is in _Tried and dropped_: "A one-shot reveal is simpler in CSS, and the hand-built Rive art was weaker than the generated art" (`design-workflow.md:54`).
- **Motion that already ships. None of it uses a JS library:**
  - **Etched plates:** CSS keyframes, each with its own `@media (prefers-reduced-motion: reduce) { animation: none }`, so the finished frame shows:
    - `EtchedScene.svelte:63,126`: mask sweep, 1.6 s.
    - `EtchedSky.svelte:48,59`: fade and translate, 2.4 s, starting at 900 ms.
    - `EtchedFlock.svelte:30,41`: 2.4 s, starting at 1.3 s.
    - `EtchedVignette.svelte:45,50`.
  - **Card transitions between auth routes (#230):** the View Transitions API through `onNavigate` (`apps/web/src/routes/(auth)/+layout.svelte:14-16`). It is gated in `apps/web/src/lib/card-transition.ts:18-20`: `"startViewTransition" in document && !prefersReducedMotion.current`. `AuthShell` stays mounted, so the art plays once per full load.
  - **Feedback icons (#177):** vendored moving icons (`$lib/components/movingicons/*`). They are pure CSS, so the global rule covers them (`movingicons.svelte.test.ts:72-85`).
  - **Svelte transitions:** used only in the `/design-system` demo, gated (`apps/web/src/routes/design-system/MotionDemo.svelte:26`).
  - **Toasts:** `svelte-sonner` ships its own `prefers-reduced-motion` CSS (`node_modules/svelte-sonner/dist/Toaster.svelte`).
  - **Registry overlays:** open and close through `tw-animate-css` keyframes, which the global rule covers.
- **Hosting.**
  - `apps/web/wrangler.toml` sets `pages_build_output_dir = ".svelte-kit/cloudflare"`.
  - `apps/web/package.json` deploys with `wrangler pages deploy`.
  - The adapter is `@sveltejs/adapter-cloudflare` (`apps/web/svelte.config.js`).
  - `docs/ARCHITECTURE.md:121-124` says "Frontend (Cloudflare Pages)… static assets + Pages Functions".
  - ADR-0009 decides "All on Cloudflare" and lists "Pages + Workers" as the option. So the ticket's "Cloudflare Pages" is correct.
  - Cloudflare's Pages→Workers migration guide doesn't deprecate Pages ([migrate from Pages](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)).
- **Bundle baseline, measured from `vite build` on this commit (`b4a06e7`):**
  - `/login` loads **435.4 kB min / 150.1 kB gz / 132.7 kB br** of JS across 26 chunks: entry, app, root layout, `(auth)` layout and login page.
  - The error page loads 323.4 / 116.1 / 102.7 kB.
  - The desktop auth art is 163 + 54 + 16 kB of WebP masks. An error page loads one 60–107 kB mask (`apps/web/src/lib/assets/{auth,errors}`).
- **How the art is made.** Each plate is **one raster alpha mask**: black RGB with ink density in the alpha channel. `docs/design/etched-login/prepare-etching.py` makes it from a Recraft engraving (paper at luminance ≥ 212 becomes transparent). The page draws it with CSS `mask-image` over `--etching`, so one file serves light and dark (`docs/design/etched-login/README.md`, _Asset pipeline_). Nothing inside a plate is separable. The trucks, crane and water are pixels in the same mask as the bridge behind them.

---

## 1. Where motion carries meaning, and where it is decoration (Q1)

The guidance was collected in `docs/research/icon-set-and-animated-icons.md` §3 (accessed 2026-09-24):

- Carbon: "productive" motion for task UI, 70–240 ms, and "always a way to communicate similar messages statically" ([Carbon motion](https://carbondesignsystem.com/elements/motion/overview/)).
- Atlassian: "Motion is a clarifying layer, not decoration" ([Atlassian motion](https://atlassian.design/foundations/motion)).
- WCAG 2.2 SC 2.2.2: auto-playing motion longer than 5 s needs a pause control ([Understanding 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)).
- WCAG 2.2 SC 2.3.3 (AAA): motion triggered by interaction can be disabled ([Understanding 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)).

The repo's own storyboards already chose "No shake" for errors and "no success animation to wait for" on sign-in (`docs/design/etched-login/README.md:30-31`).

| Moment                                                                                    | Carries meaning?                                                    | Tool that already covers it                                         |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Submit pending                                                                            | Yes: the action is running                                          | Spinner **plus text** (ADR-0035 rule 6), `motion-safe:animate-spin` |
| Copy, save or refresh confirmed                                                           | Yes: a state change                                                 | Moving icons (CSS), ADR-0035 rule 3                                 |
| Field or form error appears                                                               | Only the arrival. No shake                                          | Opacity or height ease in CSS, or nothing                           |
| Toast in and out                                                                          | Yes: where it came from and that it left                            | `svelte-sonner` (its own reduced-motion CSS)                        |
| Dialog, popover or select opening                                                         | Yes: where it opens from                                            | Registry + `tw-animate-css` (CSS)                                   |
| Card change between auth routes, activate steps                                           | Yes: same frame, new content                                        | View Transitions via `onNavigate` (`card-transition.ts`)            |
| Rows added, removed or reordered in short lists                                           | Yes, for a few items                                                | `animate:flip` + `transition:`, gated on `prefersReducedMotion`     |
| Large data tables, paging, sorting                                                        | No: many rows moving at once is noise                               | None                                                                |
| Etched scenes                                                                             | Brand, not information. Allowed as a one-shot entrance that settles | CSS keyframes (§3)                                                  |
| Idle loops, parallax, scroll reveals, hover lifts, number count-ups, shimmering skeletons | Decoration                                                          | Avoid. A skeleton stays static and carries text                     |

---

## 2. The options

### 2.1 CSS and Svelte built-ins (plus WAAPI)

- **Svelte transitions run on WAAPI, not CSS.** "Transitions are driven by the Web Animations API rather than by CSS. A global `@media (prefers-reduced-motion: reduce)` rule… therefore has no effect on them. Use `prefersReducedMotion`…" ([transition:](https://svelte.dev/docs/svelte/transition)).
- **`svelte/motion` exports:** `Spring` and `Tween` (since 5.8.0), and `prefersReducedMotion`, a reactive `MediaQuery` (since 5.7.0) ([svelte/motion](https://svelte.dev/docs/svelte/svelte-motion)). The repo is on `svelte@^5.57.1`.
- **Transitions don't play on the SSR first paint.**
  - Svelte's `hydrate()` defaults `intro` to `false` (`svelte@5.57.1` `src/internal/client/render.js:97`: `options.intro = options.intro ?? false`).
  - SvelteKit's client creates the root with `hydrate` and no `intro` (`@sveltejs/kit@2.70.3` `src/runtime/client/client.js:703-706`).
  - So `in:`/`transition:` play on client-side changes, but **not on the first paint of a server-rendered page**.
  - CSS keyframes do play there, and they start before the JS hydrates. _(inference)_ That is why the etched entrances are CSS and should stay CSS.
- **Marginal cost.** The transition helpers (`fade`, `fly`, `slide`, `draw`, `crossfade`, `flip`) add **1.8 kB gz** on top of the Svelte runtime the app already ships. `Tween`/`Spring` reuse the same reactivity runtime. Their marginal cost was not isolated.
- **What the built-ins don't have:**
  - A timeline or sequence API: CSS delays or chained promises stand in for it.
  - Path morphing.
  - Layout animation across components: `animate:flip` only works inside a keyed `{#each}`, and `crossfade` pairs elements across lists.
  - Scroll-linked animation.
  - `draw` animates **strokes**, so it doesn't help with filled, traced engravings.
- **CSS features the scenes would use:**
  - `mask-image` compositing: Baseline widely available since 2026-06-07 ([web-features `masks`](https://github.com/web-platform-dx/web-features/blob/main/features/masks.yml.dist)).
  - `linear()` easing, which gives CSS a spring-like "roll to a stop" or "settle" with no JS: widely available since 2026-06-11 ([`linear-easing`](https://github.com/web-platform-dx/web-features/blob/main/features/linear-easing.yml.dist)).
  - `offset-path` for curved paths such as a flock's arc: widely available since 2025-03-12 ([`motion-path`](https://github.com/web-platform-dx/web-features/blob/main/features/motion-path.yml.dist)).
  - `@property`, which the plates' reveal already uses: newly available since 2024-07-09 ([`registered-custom-properties`](https://github.com/web-platform-dx/web-features/blob/main/features/registered-custom-properties.yml.dist)).
- **WAAPI directly.** `element.animate()` has been widely available since 2023-03-16 ([`web-animations`](https://github.com/web-platform-dx/web-features/blob/main/features/web-animations.yml.dist)). It costs 0 kB. `animation.finish()` jumps to the end state, which gives a JS path to "reduced motion shows the finished state" with no library.

### 2.2 View Transitions API

- **Support.** Same-document view transitions (`document.startViewTransition`) have been **Baseline newly available since 2025-10-14**: Chrome/Edge 111, Firefox 144, Safari 18 ([web-features `view-transitions`](https://github.com/web-platform-dx/web-features/blob/main/features/view-transitions.yml.dist)). Cross-document view transitions are **not Baseline**: no Firefox; Chrome 126, Safari 18.2 ([`cross-document-view-transitions`](https://github.com/web-platform-dx/web-features/blob/main/features/cross-document-view-transitions.yml.dist)). SvelteKit's client routing only needs the same-document API.
- **SvelteKit integration.** `onNavigate` "runs… immediately before we navigate to a new URL except during full-page navigations. If you return a `Promise`, SvelteKit will wait for it to resolve… This allows you to… use `document.startViewTransition`" ([`$app/navigation`](https://svelte.dev/docs/kit/$app-navigation#onNavigate)). The repo already does this, with a feature check that falls back to a plain swap (`card-transition.ts`).
- **Reduced motion.** The `::view-transition-*` pseudo-elements are outside the `*, ::before, ::after` global rule, so the repo gates in JS (ADR-0035 rule 6). No change is needed.

### 2.3 Motion (motion.dev), vanilla

- **Package and licence.** `motion@13.4.6` (npm `latest`, modified 2026-09-29) is **MIT** (`package.json`). Motion+ is a separate paid, one-time-payment toolkit of examples and "advanced APIs" ([quick start](https://motion.dev/docs/quick-start)). The vanilla `animate()` doesn't need it. Motion has no Svelte package. The community `@humanspeak/svelte-motion` is at 1.5.0 (MIT) and isn't needed for vanilla use.
- **Sizes, from the docs.** `animate()` "comes in two sizes, mini (2.3kb) and hybrid (18kb)". Mini animates "HTML and SVG styles using native browser APIs". Hybrid adds independent transforms (`x`, `y`), CSS variables, `mask-image`, SVG paths and sequences ([animate](https://motion.dev/docs/animate)).
- **Sizes, measured:** `motion/mini` is **9.7 kB min / 3.9 kB gz / 3.6 kB br**. `animate` from `motion` (hybrid) is **55.0 / 20.2 / 18.5 kB**. `stagger` is almost free (+0.1 kB).
- **Reduced motion, from source and a test.**
  - The vanilla docs say nothing about reduced motion. The TypeScript comment on the `reduceMotion` transition option says "`undefined`: Use device preference (default behavior)" (`motion-dom@13.4.5` `dist/index.d.ts:2374-2380`).
  - But for a plain DOM element, `animateElement()` wraps it in an `EffectSubject`, which has no `shouldReduceMotion`. The media query is only read for React/`motion.*` VisualElements (`motion-dom` `dist/es/animation/animate/element.mjs:50-60`, `effects.mjs:30`, `render/VisualElement.mjs:205-216`).
  - **Tested** in Chromium (Playwright, `reducedMotion: "reduce"`): `animate(el, { x: [0, 100] }, { duration: 1 })` was at `x ≈ 30.6` after 200 ms, the same as with no preference. With `reduceMotion: true` it was at `x = 100` straight away.
  - So Motion **needs the same explicit `prefersReducedMotion` gate** as Svelte transitions. Even then, `reduceMotion` only skips "transform/layout" keys, and opacity still animates.
- **SSR.** `import("motion")` and `import("motion/mini")` succeed in Node with no DOM (tested, Node 24.13).

### 2.4 GSAP: the licence as it stands today

- **Package and licence.** `gsap@3.15.0` (published 2026-04-13). Its `package.json` `license` field is `Standard 'no charge' license: https://gsap.com/standard-license`, and the README says "Copyright (c) 2008-2026, GreenSock. All rights reserved."
- **The Webflow change.**
  - Webflow acquired GreenSock in October 2024 ([Webflow blog](https://webflow.com/blog/webflow-acquires-gsap); the 2024-10-15 date comes from search results, **UNVERIFIED** on the page itself).
  - On 2025-04-30 GSAP became "100% free", "including the previously paid Club plugins" such as SplitText and MorphSVG ([Webflow update](https://webflow.com/updates/gsap-becomes-free)).
- **The licence text** ([gsap.com/standard-license](https://gsap.com/standard-license); effective 2025-04-30, last modified 2025-05-30):
  - Permitted Uses: "The implementation and/or use of GSAP Products on any website, web application, or digital interface by any person or entity." Commercial use is covered.
  - Excluded: use in "Competitive Products", meaning tools that let "users to create, edit, or manage animations through a visual interface or builder similar to Webflow".
  - "All intellectual property rights in GSAP Products… remain the exclusive property of Webflow."
  - "Webflow reserves the right to update or modify this GSAP License at any time by posting the revised terms on this website." Webflow may also terminate it for non-compliance.
  - _(inference)_ VMB, a logistics admin app, is a Permitted Use. But GSAP is **proprietary and free of charge, not open source**, and its terms can change without a version bump. ADR-0035 prefers MIT/ISC dependencies (Lucide ISC, moving icons MIT).
- **Sizes, measured:**
  - Core (`gsap`, which includes CSSPlugin): **70.7 kB min / 27.6 kB gz / 25.0 kB br**.
  - Plus DrawSVG: 74.9 / 29.3 / 26.5.
  - Plus DrawSVG, MorphSVG and MotionPath: 109.5 / 43.2 / 38.8.
  - DrawSVG and MorphSVG work on vector paths, so they don't help with raster ink masks.
- **Reduced motion.** Not automatic. `gsap.matchMedia()` takes a `reduceMotion: "(prefers-reduced-motion: reduce)"` condition, and animations created inside it are reverted when the condition changes ([gsap.matchMedia()](<https://gsap.com/docs/v3/GSAP/gsap.matchMedia()>)).
- **SSR.** `import("gsap")` and `gsap/DrawSVGPlugin` succeed in Node (tested).

### 2.5 Rive: the framework-agnostic web runtime

- **Packages.** `@rive-app/canvas`, `canvas-lite`, `webgl` and `webgl2` share one API. `webgl2` is "the package we recommend for most projects" (Rive Renderer, supports everything in the editor). `canvas-lite` is for projects "not using Rive Text, Rive Layouts, Rive Scripting, or Rive Audio" ([Web (JS)](https://rive.app/docs/runtimes/web/web-js)). The `canvas-lite` README says it "will not render Rive Text… or play Rive Audio". All are **MIT**, v2.43.1 (published 2026-09-23), from `rive-app/rive-wasm`.
- **No Svelte package, and none is needed.** `@rive-app/svelte` doesn't exist on npm (404). The vanilla `new Rive({ canvas, src, … })` runs from an `onMount` or attachment. #177's "no official Svelte runtime" wasn't the real blocker. The real costs are below.
- **Sizes, measured.** JS (min / gz / br), then the `rive.wasm` it fetches (raw / gz / br):

  | Package       | JS                  | WASM                      |
  | ------------- | ------------------- | ------------------------- |
  | `canvas-lite` | 179.0 / 49.5 / 43.5 | 882 / 358.9 / **278.9**   |
  | `canvas`      | 200.3 / 57.1 / 50.2 | 1,955 / 803.9 / **627.7** |
  | `webgl2`      | 203.9 / 57.8 / 50.8 | 2,224 / 905.7 / **716.8** |

  Each package also ships a same-sized `rive_fallback.wasm` for older CPUs. Even `canvas-lite` adds about 33% to `/login`'s JS (49.5 of 150.1 kB gz). Its WASM alone is about twice the route's whole JS, compressed.

- **WASM loading.**
  - By default the runtime fetches `https://unpkg.com/<package>@<version>/rive.wasm`, with a jsDelivr fallback (`@rive-app/canvas/rive.js:327-330`).
  - Self-hosting uses `RuntimeLoader.setWasmUrl()`. A `<link rel="preload">` must use exactly the same URL, "or the preloaded bytes are discarded and the file downloads twice" ([Preloading WASM](https://rive.app/docs/runtimes/web/preloading-wasm)).
  - On Pages, a 2 MB `.wasm` fits the 25 MiB per-asset limit ([Pages limits](https://developers.cloudflare.com/pages/platform/limits/)). `application/wasm` is on Cloudflare's default compression list ([compression](https://developers.cloudflare.com/speed/optimization/content/compression/)). Whether that covers Pages static assets is **UNVERIFIED**.
  - The repo sets no CSP today (grep found none), so `wasm-unsafe-eval` isn't a concern yet.
- **SSR.** All three packages import without error in Node (tested). But a canvas renders empty on the server, so the first paint shows no Rive art until the JS, the WASM and the `.riv` have loaded _(inference)_.
- **Reduced motion.**
  - "Runtimes do not automatically detect reduced motion… pass the user's motion preference into the file yourself", through a data-binding property (for example `prefersReducedMotion`), separate state-machine paths, or speeds bound to 0 ([Reduced Motion](https://rive.app/docs/editor/accessibility/reduced-motion)).
  - The JS API also has `autoplay`, `play`, `reset`, and a deprecated `scrub(animationNames, value)` (`rive.d.ts:336,925,942,960`).
  - So "show the finished frame" means authoring a rest state in the file and selecting it from `prefersReducedMotion.current`.
- **Authoring and plan.**
  - "Export .riv files" starts at **Cadet, $9 a seat a month** (at most 3 seats). The free plan can't export ([pricing](https://rive.app/pricing)). `design-workflow.md` records Cadet as not bought.
  - The editor imports "JPEG, PNG, WebP", SVG and PSD. Raster assets can be embedded (WebP compression recommended) or referenced and loaded at runtime. "Hosted" needs Voyager ([Assets](https://rive.app/docs/editor/fundamentals/assets-overview)).
  - Raster meshes allow deformation ([Rive blog](https://rive.app/blog/new-features-released-mesh-deformation-and-psd-support)).
  - So the engraving can go in as raster layers, but it still has to be **split into layers first** (§3).
- **Colour tokens.** The plates are coloured by CSS: `mask-image` over `background: var(--etching)`, one file for both schemes. A canvas can't be used as a CSS mask in Chromium or Safari, and Rive's raster images draw their own pixels. Keeping one asset tinted by `--etching` in light and dark would need a Rive-side tint or a data-bound colour for raster layers. Whether Rive supports that is **UNVERIFIED**. Without it, the choice is two sets of art, or vector art with data-bound fills, which brings back the vector weight problem in §3.

### 2.6 Lottie (for completeness, given #177)

- `lottie-web@5.13.0` (MIT, last published **2025-05-21**): full build **78.7 kB gz** (309.0 kB min). The SVG-only `lottie_light` build is **48.9 kB gz**.
- `@lottiefiles/dotlottie-web@0.80.0` (MIT, 2026-08-28): JS 13.8 kB gz plus `dotlottie-player.wasm`, **1,238 kB raw / 496.4 kB gz / 388.2 kB br**. That matches #177's "~500 KB".
- Authoring goes through After Effects or LottieFiles tools, and a raster-heavy scene embeds its images in the JSON. Built-in reduced-motion handling is **UNVERIFIED**, as in the icon note. It has the same layer-splitting cost as the other options. Nothing favours it here.

### 2.7 Measured sizes in one place

| Option                                            | JS gz (kB)                                | Extra download                              | Licence                              | SSR import                           |
| ------------------------------------------------- | ----------------------------------------- | ------------------------------------------- | ------------------------------------ | ------------------------------------ |
| CSS keyframes and transitions                     | 0                                         | —                                           | —                                    | n/a                                  |
| Svelte transition helpers (on top of the runtime) | 1.8                                       | —                                           | MIT                                  | built in                             |
| WAAPI `element.animate()`                         | 0                                         | —                                           | —                                    | n/a                                  |
| View Transitions API                              | 0 (already shipped: `card-transition.ts`) | —                                           | —                                    | n/a                                  |
| Motion `motion/mini`                              | 3.9                                       | —                                           | MIT                                  | ok                                   |
| Motion `animate` (hybrid)                         | 20.2                                      | —                                           | MIT                                  | ok                                   |
| GSAP core / + DrawSVG / + Morph and MotionPath    | 27.6 / 29.3 / 43.2                        | —                                           | Webflow "no charge", proprietary     | ok                                   |
| Rive `canvas-lite` / `canvas` / `webgl2`          | 49.5 / 57.1 / 57.8                        | WASM 279 / 628 / 717 kB br, plus the `.riv` | MIT runtime, editor Cadet $9/seat/mo | ok (the canvas is blank server-side) |
| lottie-web light / full                           | 48.9 / 78.7                               | JSON plus embedded images                   | MIT                                  | ok                                   |
| dotLottie web                                     | 13.8                                      | WASM 388 kB br                              | MIT                                  | ok                                   |

Baseline for comparison: `/login` 150.1 kB gz of JS, error page 116.1 kB gz.

---

## 3. The etched scenes (#235): pipelines compared

The brief (owner, 2026-09-29, and #235):

- The parts move once on first load and then rest: trucks, flock, clouds, light on the water, a crane setting down a container. The error vignettes get the same, plus a truck on the lost road, the gate swinging shut and the crates toppling.
- Everything settles within about 4 s.
- The static plate paints first.
- The ink-mask look on `--etching` stays in both schemes.
- Reduced motion shows the finished frame.

### 3.1 Work every option needs

**The layer split is the same job whichever runtime draws the result.** A moving part has to become its own image, and the plate needs something behind that part. Take the landscape master (`docs/design/etched-login/sources/landscape-a1-4096.jpg`): the three trucks sit on the bridge deck in front of the container yard and water hatching. Cutting them out leaves holes in that hatching.

Two ways to get the layers:

- **Cut and fill.** Cut each part from the existing master into its own mask, then fill the hole in the plate. Options for the fill:
  - Hand editing in an image editor.
  - Recraft's `eraseRegion` or `inpaint`, which exist as REST endpoints ([Recraft API endpoints](https://www.recraft.ai/docs/api-reference/endpoints)). The Recraft **MCP** exposes them as `erase_region` and `inpaint_image` (checked 2026-09-30, after the MCP reconnected); their credit cost is **UNVERIFIED**. The REST API also needs separately bought API units (`design-workflow.md`, _Recraft_).
- **Generate each layer separately.** `design-workflow.md:12` already says to generate a separate image per moving layer. But regenerating a scene "without the trucks" drifted from the original last time: round 2's image-to-image E1 and E2 "Drifted too far from A1" (`docs/design/etched-login/README.md`, round 2 table). _(inference)_ For the existing plates, cut-and-fill keeps the approved art. Generating layers separately suits new ornaments, such as the error pages' extra truck and gate leaves.

A cheaper variant avoids the fill: hide the part's region in the plate while the part moves, then swap back to the plate. The price is bare paper behind the moving part for up to 4 s. That is a design call (open question 1).

### 3.2 Pipeline A: per-part raster ink masks, CSS keyframes (recommended)

- **Assets.** One `prepare-etching.py`-style WebP mask per moving part, plus the filled plate. The plate stays the same size as today.
- **Measured part weights.** The parts were cut from the 4096px master and scaled to the shipped 2400px plate's resolution (×0.47), using the script's own luminance mapping and `cwebp -q 60 -alpha_q 50` settings:

  | Part                        | Size in px     | WebP           |
  | --------------------------- | -------------- | -------------- |
  | Each truck                  | about 155 × 70 | **3.1–3.5 kB** |
  | Left gantry crane           | 251 × 135      | **8.1 kB**     |
  | Water band under the bridge | 676 × 107      | **10.7 kB**    |

  A full landscape choreography (three trucks, a crane container, a water sheen band, and cloud pieces split from the 54 kB sky) would add about **30–60 kB** at desktop _(inference, from those numbers)_.

- **Drawing.** Each part is an absolutely positioned element over the plate, placed in plate percentages. It uses `mask-image: url(part.webp)` over `var(--etching)`, the same technique as today, so both schemes and ADR-0036 hold. An inline SVG whose `viewBox` is the plate's pixel size, holding `<image>`/`<mask>` layers, is an equivalent way to position them. That is an implementation detail for #235.
- **Motion:**
  - Trucks: `translate` in from the left, then stop, with `linear()` easing for the roll-out.
  - Crane: the container's `translate` down, with a `scale` on the cable.
  - Water: a gradient sweep inside the water mask, the same `mask-composite: intersect` trick as `EtchedScene`'s reveal.
  - Flock: staggered per-bird `translate` or `offset-path`.
  - Gate: `rotateY` with `perspective` on each leaf.
  - Crates: `rotate` about a corner.
  - All of it uses `animation-fill-mode: both` and staggered `animation-delay`s, finishing by about 4 s.
- **"Once, then rest":** keyframes with one iteration end in the element's natural styles, which is the rest position. They start at first paint from the SSR HTML, with no JS. #230's persistent layout keeps them from replaying between auth routes.
- **Reduced motion:** the global rule plus each component's `animation: none`, which shows the natural, finished state. Both are already the pattern (§0).
- **Authoring:** the existing Python script and CSS. No paid tool beyond Recraft, if Recraft does the fill.

### 3.3 Pipeline B: vectorised SVG groups (Recraft `vectorize_image`)

- **Weight, measured.** The same crops were traced at source resolution with `vtracer` (binary mode) as a stand-in for Recraft's vectoriser:

  | Crop            | SVG         | SVG gz      | vs WebP mask                      |
  | --------------- | ----------- | ----------- | --------------------------------- |
  | Truck           | 55.6 kB     | 20.3 kB     | about 6× the 3.5 kB mask          |
  | Crane           | 175.1 kB    | 51.5 kB     | about 6×                          |
  | Water           | 123.6 kB    | 42.7 kB     | about 4×                          |
  | Whole landscape | **3.85 MB** | **1.07 MB** | the shipped 2400px mask is 163 kB |

  Recraft's tracer will give different numbers (**UNVERIFIED**), but hatching is thousands of tiny filled shapes whichever tool traces it. `design-workflow.md` already says "Dense engraving hatching doesn't suit vector animation."

- **Tone.** A trace is binary, so the alpha channel's ink density (the soft grey of light hatching) is lost _(inference from the binary trace)_.
- **No draw-on effect.** The traced shapes are filled outlines, not strokes, so Svelte's `draw`, `pathLength` and GSAP's DrawSVG can't produce a "drawn line" effect from them.
- **When it fits:** a small, simple ornament, such as a signpost or the gate's bars. Then it can use `fill: currentColor` on the token. Not the plates.

### 3.4 Pipeline C: a Rive file

- **Assets:** the same cut-and-filled raster parts (3.1), imported into the Rive editor as WebP or PNG. The parts are placed there, animated on a timeline, and exported as one `.riv` with the images embedded. The image weight is about the same as Pipeline A. On top of that come the runtime and WASM (2.5): at best `canvas-lite`, 49.5 kB gz of JS plus 279 kB br of WASM.
- **Tooling:** the Rive editor with the **Cadet plan** ($9 a seat a month), and a hand-built animation file that has to be kept in sync with the plate's ratios. Those ratios are currently tested in `etched-scene.test.ts` and `error-page.test.ts`.
- **"Static plate paints first":** the canvas is blank until JS, WASM and `.riv` arrive. Either the static plate stays as a CSS layer under a canvas that only draws the moving parts, which still needs the holes filled, or the plate itself waits for the WASM, which breaks the #235 criterion. On a slow connection, the "settle within ~4 s of first paint" window can pass before the runtime has loaded _(inference)_.
- **Reduced motion:** a rest state authored in the file and chosen from `prefersReducedMotion.current` (2.5). This is extra authoring work for every scene.
- **Colour:** the `--etching` two-scheme colouring doesn't carry over (2.5). That is the biggest unknown.
- **What Rive would add** that CSS can't do: mesh deformation (ripples, flexing), bones, and state machines for interactive or looping art. The owner ruled out idle loops, and the scenes aren't interactive.

### 3.5 Side by side

| Criterion                      | A: raster masks + CSS                   | B: SVG groups + CSS/JS                 | C: Rive                                               |
| ------------------------------ | --------------------------------------- | -------------------------------------- | ----------------------------------------------------- |
| Art split and hole fill        | Needed                                  | Needed, plus tracing and cleanup       | Needed                                                |
| Asset weight per moving part   | 3–11 kB (measured)                      | 20–52 kB gz (measured stand-in)        | About A's, embedded in the `.riv`                     |
| New JS / WASM                  | 0 / 0                                   | 0 (CSS) or 4–29 kB gz (Motion or GSAP) | 49.5–57.8 kB gz / 279–717 kB br                       |
| Plays from the SSR first paint | Yes, before hydration                   | Yes with CSS; no with JS               | No: waits for the WASM                                |
| `--etching` in both schemes    | Yes (as today)                          | Yes (`currentColor`)                   | **UNVERIFIED**; probably two art sets or vector fills |
| Ink-density tone kept          | Yes                                     | No (binary trace)                      | Yes (raster)                                          |
| Reduced motion to final frame  | Global rule + `animation: none`         | Same, or a JS gate                     | Author a rest state and bind it                       |
| Tooling and cost               | Python script + CSS (+ Recraft credits) | Recraft vectorise, 1 credit per image  | Rive editor, Cadet $9/seat/mo                         |

---

## 4. SSR and Cloudflare Pages

- **Importing on the server.**
  - Every candidate imports in Node 24.13 with no DOM without throwing: `motion`, `motion/mini`, `gsap`, `gsap/DrawSVGPlugin`, the three `@rive-app/*` packages, `lottie-web` and `@lottiefiles/dotlottie-web`.
  - This was **not** tested inside `workerd` (**UNVERIFIED**, but Pages Functions only run the server bundle).
  - Whatever the result, the rule is: import JS animation code only on the client, through `onMount`, an attachment, or a dynamic `import()` behind `browser`. That keeps it out of the server bundle and off `/login`'s critical path.
- **Hydration.** Svelte transitions don't run on the hydrated first paint (2.1). A JS library that animates SSR'd markup "from" an offset makes the element jump: it paints at rest, then snaps back to the start when the JS runs. The alternative is hiding it with CSS until the JS runs, which fails with no JS or slow JS _(inference)_. CSS keyframes avoid both, and #230's no-JS requirement already rules out JS-only motion on auth pages.
- **WASM on Pages.** It works as a static asset (25 MiB limit), but it is fetched from unpkg unless it is self-hosted with `setWasmUrl()`. Self-hosting is the only option consistent with "Cloudflare only" (ADR-0009) and with the Recraft-style third-party network trouble the maintainer's office already sees _(inference)_.
- **Lazy loading.** If a library is ever adopted, `await import("motion")` inside the component that needs it gives it its own Vite chunk. It must never load on first paint for the auth or error pages.

---

## 5. How each option meets the reduced-motion contract

| Option                                          | Honoured automatically?                                         | What VMB must do                                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| CSS keyframes and transitions                   | Yes: the global rule (`app.css:179-190`)                        | Add `animation: none` in the component, so the frame is the natural end state (the pattern in `Etched*.svelte`)          |
| Svelte `transition`/`animate`, `Tween`/`Spring` | No (WAAPI or JS)                                                | `duration: prefersReducedMotion.current ? 0 : n`, or `Tween.set(v, { duration: 0 })`, `Spring.set(v, { instant: true })` |
| View Transitions                                | No (the pseudo-elements are outside the rule)                   | Skip `startViewTransition` (already done)                                                                                |
| WAAPI                                           | No                                                              | Don't start it, or call `animation.finish()`                                                                             |
| Motion `animate()`                              | **No** for plain elements (tested)                              | Gate on `prefersReducedMotion`, or pass `reduceMotion: true` (transforms only; opacity still animates)                   |
| GSAP                                            | No                                                              | `gsap.matchMedia()` with a `reduceMotion` condition, or `duration: 0`                                                    |
| Rive                                            | No ("pass the user's motion preference into the file yourself") | Author a rest state and set it from `prefersReducedMotion.current`, or `autoplay: false` on a final frame                |
| Lottie / dotLottie                              | **UNVERIFIED**                                                  | Would need an explicit gate                                                                                              |

---

## 6. Recommendation (opinion, for the follow-up ADR; not a cited fact)

**Proposed decision (ADR-0040): no general-purpose JS motion library for now. The toolset is:**

1. **CSS first:** keyframes, transitions, `tw-animate-css`, moving icons, and `linear()` easing for spring-like settles. These are covered by the global reduced-motion rule and run before hydration and without JS.
2. **Svelte built-ins** for motion driven by component state: `transition:`/`in:`/`out:`, `animate:flip`, `Tween`/`Spring`. Always gated on `prefersReducedMotion` (rule 6 as it stands).
3. **The View Transitions API through `onNavigate`** for same-frame content changes, as `card-transition.ts` does. It stays a progressive enhancement.
4. **WAAPI directly** in the rare imperative case, using `finish()` for reduced motion.

**Etched scenes (#235): Pipeline A.**

- Cut per-part raster ink masks from the approved masters, fill the holes, and animate with CSS keyframes that end at rest.
- Record the split-and-fill method in the #235 design-round README.
- Rive stays where `design-workflow.md` puts it: reserved for art with real states or interaction.

**Budget, for the ADR to fix:**

- New motion JS on `/login` and the error page: **0 kB** for #235.
- Any future motion library: **≤ 25 kB gz, loaded lazily**, never on those pages' first paint and never WASM. That is about 17% of `/login`'s current 150 kB gz. It leaves room for Motion's hybrid `animate` (20.2 kB) and rules out the Rive and Lottie runtimes.
- Moving-part art: **≤ 60 kB per page at desktop**, on top of today's masks, measured in the round README the way the plates are today.

**Why:**

- Every moment in §1 and every part of the #235 brief can be expressed in CSS or the built-ins, and the repo already does it that way.
- CSS is the only option that plays from the SSR first paint, works without JS (a #230 requirement), keeps the one-file `--etching` colouring, and is covered by the reduced-motion rule for free.
- The expensive part of #235 is splitting the art. Rive and Lottie don't remove that cost, and they add a runtime of 5–10× the art's weight.

**Trade-offs accepted:**

- No timeline or sequencing API: choreography is `animation-delay` arithmetic in CSS.
- No path morphing or deformation.
- The water "light" is a gradient sweep, not a ripple.

**What would change the call:**

- The owner wants interactive or stateful art (a truck that reacts to hover, a scene that tells the sign-in result) or loops. Then reconsider Rive: self-hosted `canvas-lite`, loaded lazily, after a spike proves `--etching` colouring in both schemes.
- A real need for interruptible, gesture-driven or scroll-linked UI motion that Svelte's `Spring` and CSS can't express. Then adopt Motion's vanilla `animate` within the budget, with the explicit reduced-motion gate (Motion does not honour the preference on its own).
- New art that is line work rather than hatching. Then SVG with stroke drawing becomes cheap.
- GSAP only if a plugin with no equivalent becomes essential. Record the proprietary, modifiable licence as a trade-off.

---

## 7. Open questions for the owner (answered 2026-09-30)

The owner answered these on 2026-09-30. The answers go into ADR-0040.

1. **Hole fill: Recraft.** Recraft produces the layer assets. Each part's mask is cut from the approved plate, and Recraft fills the hole it leaves with `erase_region` (content-aware) or `inpaint_image` (prompted). A reconnected Recraft MCP lists both tools, and both take the source image plus a black-and-white mask (white is filled). New ornaments with no source in a plate, such as the error pages' extra truck and gate leaves, are generated as separate Recraft layers (`design-workflow.md` step 4). The credit cost of the two fill tools is still **UNVERIFIED**; log it in the #235 round README as the workflow requires.
2. **Where the scenes move: mobile, tablet and desktop.** Each breakpoint animates the parts its plate shows. The art budget applies per breakpoint.
3. **The flock's path:** as recommended, an arc through the right-hand sky that stays 2.5rem clear of the brand line and headline.
4. **Budget numbers:** as recommended: 0 kB of new JS for #235, ≤ 25 kB gz loaded lazily for any future library, ≤ 60 kB of moving-part art per page.
5. **Replay: on every full page load.** No `sessionStorage` flag. Moving between auth routes still doesn't replay, because the layout stays mounted (#230).
6. **Shared timing tokens:** as recommended: add duration and easing tokens to `app.css`.

---

## 8. Not verified

- Whether Rive can tint raster layers or bind a colour to them, which would let one `.riv` follow `--etching` in both schemes.
- That `canvas-lite` renders raster image assets. This is inferred: its README only lists Text and Audio as missing.
- Rive WASM compile and first-frame time on low-end devices, and the real-network time to first frame on `/login`.
- The credit cost of Recraft's `erase_region` and `inpaint_image`. The MCP exposes both (checked 2026-09-30 after it reconnected), but the tool schemas don't state a cost.
- How much SVG Recraft's `vectorize_image` produces for hatching. `vtracer` stood in for it.
- Imports inside `workerd`. They were tested in Node 24.13 only.
- Whether Cloudflare's automatic compression applies to Pages static `.wasm` responses.
- Lottie and dotLottie reduced-motion handling.
- Motion's documented sizes (2.3 kB and 18 kB) against these measurements (3.9 and 20.2 kB gz; 3.6 and 18.5 kB br). The difference probably comes from bundler and compression settings.
- The Webflow acquisition date (2024-10-15) comes from search-result snippets. The Webflow blog page itself was not fetched.
