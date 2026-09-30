# ADR-0040: Motion — CSS and Svelte built-ins, no JS motion library

**Context:** The owner wants richer motion across assets, components and icons, for better feedback (#210). The first build tickets are the etched scenes (#235), whose plate parts (trucks, flock, clouds, water, crane, and the error pages' vignettes) should move once on first load and then rest, and the card transitions between auth routes (#230). The contract is already on record: motion plays once and settles, reduced motion shows the finished state, nothing moves near a focused field (`docs/agents/design-workflow.md`, ADR-0035 rule 6). The repo already does its motion without a library: CSS keyframes on the etched plates, the View Transitions API through `onNavigate` in `card-transition.ts`, pure-CSS moving icons, and svelte-sonner toasts. The etched plates are single raster alpha masks coloured through `--etching`, so any per-part motion first means splitting the art. Research: `docs/research/motion-library-for-ui-feedback.md`, with sizes measured on 2026-09-30.

**Options considered:**

- CSS plus Svelte built-ins (`svelte/transition`, `svelte/animate`, `Tween`/`Spring`), View Transitions and plain WAAPI — chosen. It adds no bundle, and CSS keyframes are the only option that plays from the server-rendered first paint, before hydration and without JS.
- Motion (motion.dev), vanilla `animate` — deferred: MIT, 3.9 kB gz (mini) or 20.2 kB gz (hybrid). Nothing needs it today, and it does not honour `prefers-reduced-motion` by default on plain elements (tested), so it would need the same explicit gate as Svelte transitions.
- GSAP — rejected for now: 27.6–43.2 kB gz with the SVG plugins. It has been free for commercial use since 2025-04-30, but under Webflow's proprietary licence, which Webflow may change at any time.
- Rive (`@rive-app/canvas-lite`, `canvas`, `webgl2`) — rejected for the etched scenes. It costs 49.5–57.8 kB gz of JS plus 279–717 kB brotli of WASM, and the canvas stays blank until the WASM arrives. It can't take the `--etching` mask colouring, it doesn't detect reduced motion on its own, exporting needs a paid plan, and it still needs the same per-part art split.
- Lottie (lottie-web, dotLottie) — rejected, as in #177: 48.9–78.7 kB gz, or 388 kB brotli of WASM for dotLottie.

**Decision:** No general-purpose JS motion library. The toolset, in order of preference:

1. **CSS:** keyframes, transitions, `tw-animate-css`, moving icons, and `linear()` easing for spring-like settles. Durations and easings come from shared tokens in `app.css`, not literals in each component.
2. **Svelte built-ins** for motion driven by component state: `transition:`/`in:`/`out:`, `animate:flip`, `Tween`/`Spring`. They don't play on the hydrated first paint, so entrances that must show on first load are CSS.
3. **The View Transitions API through `onNavigate`**, as a progressive enhancement, as `card-transition.ts` does.
4. **WAAPI** (`element.animate()`) for the rare imperative case.

Every non-CSS use gates on `prefersReducedMotion`, as ADR-0035 rule 6 already requires.

**Etched scenes (#235):**

- Animate per-part raster ink masks with CSS keyframes that end at rest.
- Recraft produces the layers. Each moving part's mask is cut from the approved plate, and Recraft fills the hole behind it (`erase_region` or `inpaint_image`). New ornaments are generated as separate Recraft layers.
- The scenes move on mobile, tablet and desktop, each breakpoint animating the parts its plate shows.
- The entrance replays on every full page load, but not when moving between auth routes, because the layout stays mounted (#230).
- The flock flies in an arc through the right-hand sky and stays 2.5rem clear of the text.
- Reduced motion uses the global rule plus `animation: none`, which leaves each part at its finished state.

**Budget:**

- 0 kB of new motion JS for #235.
- Any future motion library: ≤ 25 kB gz, loaded lazily with a dynamic `import()`, never on the first paint of the auth or error pages, and never WASM.
- Moving-part art: ≤ 60 kB per page at each breakpoint, on top of today's plates. Record it in the round README the way the plate weights are recorded today.

Revisit the decision when:

- **Stateful, interactive or looping art is wanted:** reconsider Rive (self-hosted `canvas-lite`, loaded lazily), after a spike proves `--etching` colouring in both schemes.
- **UI motion needs to be interruptible, gesture-driven or scroll-linked** beyond what `Spring` and CSS can express: adopt Motion's vanilla `animate` within the budget, with an explicit reduced-motion gate.
- **New art is line work rather than hatching:** SVG with stroke drawing becomes cheap.

**Trade-offs:** There is no timeline API, so choreography is `animation-delay` arithmetic in CSS. There is no path morphing or mesh deformation either, so the water's light is a gradient sweep, not a ripple. The real cost of #235 is the art split: Recraft credits for the hole fills, whose price per call is not yet known, times three breakpoints. In return, the scenes paint and move before any JS loads and work without JS, keep one art set coloured by `--etching` in both schemes, and inherit the reduced-motion rule for free. The auth and error pages also carry no runtime several times heavier than the art it would move.
