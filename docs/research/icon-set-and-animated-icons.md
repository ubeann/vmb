# Icon set and animated icons research: Lucide vs alternatives, animation options, UX/a11y, stored icon names

Research date: **2026-09-24** (all pages, npm registry entries and GitHub API responses accessed on this date).
Stack baseline verified from this repo: `@lucide/svelte@^1.47.0`, `svelte@^5.15.0`, `bits-ui@^2.19.2`, `tailwindcss@^4.3.3`, `tw-animate-css@^1.4.0`, `shadcn-svelte@^1.7.0` (see `apps/web/package.json`); shadcn-svelte `style: "nova"`, `iconLibrary: "lucide"` (see `apps/web/components.json`); ADR-0035 rules 3 (Lucide, per-icon imports) and 6 (reduced motion collapsed globally in `apps/web/src/app.css`, which zeroes `animation-duration` / `transition-duration` under `prefers-reduced-motion: reduce`); `HeroIcon.svelte` + `hero-icons.ts` map 17 Heroicons names to Lucide with a `shapes` fallback.

Legend: **UNCONFIRMED** = could not be verified from a primary source; not guessed. Every other statement has a citation directly below it. Statements marked _(inference)_ are reasoning from cited facts, not a sourced claim. Icon counts from the Iconify API count every variant/weight as a separate icon; they are only comparable within that caveat.

---

## 1. Base icon set: is Lucide still the right choice?

### 1.1 Lucide (current)

**Claim:** `@lucide/svelte` latest is **1.48.0**, published 2026-09-24, peer `svelte: ^5`, ISC. The GitHub repo was pushed 2026-09-24 (~24.7k stars). The repo holds **1,854** SVGs in `icons/`.

- https://registry.npmjs.org/@lucide/svelte
- https://api.github.com/repos/lucide-icons/lucide
- https://github.com/lucide-icons/lucide/tree/main/icons (counted via the git tree API)

**Claim:** Licence is ISC; a listed subset of icons derived from Feather is additionally under MIT (Cole Bemis). (GitHub's licence detector reports `NOASSERTION` because of this dual text.)

- https://github.com/lucide-icons/lucide/blob/main/LICENSE

**Claim:** Tree-shaking: "Lucide is built with ES Modules, so it's completely tree-shakable… only the icons that are imported into your project are included in the final bundle." Per-icon import is `@lucide/svelte/icons/<name>`. Props: `size`, `color`, `stroke-width`, `nonScalingStroke`, `default-class`; any SVG attribute is forwarded.

- https://github.com/lucide-icons/lucide/blob/main/docs/guide/svelte/getting-started.md (https://lucide.dev/guide/svelte/getting-started)

**Claim:** Package `sideEffects: false`; exports `.`, `./icons` (full barrel) and `./icons/*` (per-icon). The root module also exports `icons` (namespace of every icon) and a generic `Icon` component.

- https://github.com/lucide-icons/lucide/blob/main/packages/svelte/package.json
- https://github.com/lucide-icons/lucide/blob/main/packages/svelte/src/lucide-svelte.ts
- https://registry.npmjs.org/@lucide/svelte/1.48.0 (`exports`)

**Claim (dynamic by name):** Lucide documents a `DynamicIcon` only for React, explicitly for "when icon names are stored in a database", and says it is "not recommended, since it is importing all icons during the build", with caveats (build time, one module per icon/more requests, flashing, SSR availability). No Svelte equivalent is documented.

- https://github.com/lucide-icons/lucide/blob/main/docs/guide/react/advanced/dynamic-icon-component.md
- https://github.com/lucide-icons/lucide/tree/main/docs/guide/svelte (no dynamic-icon page in the Svelte guide tree)

**Claim:** An issue asking for an official API to list all icons is still open (#2691, opened 2024-12-15). Per-icon metadata (tags, categories) lives in `icons/<name>.json` in the repo, e.g. `truck` → tags `delivery, van, shipping, haulage, lorry`, category `transportation`.

- https://github.com/lucide-icons/lucide/issues/2691
- https://github.com/lucide-icons/lucide/blob/main/icons/truck.json

**Claim:** Lucide icons ship `aria-hidden="true"` by default; passing `aria-label` or a `<title>` child removes it. For icon buttons the label goes on the button, not the icon.

- https://github.com/lucide-icons/lucide/blob/main/docs/guide/svelte/advanced/accessibility.md

**Claim:** Lucide Lab (companion set) has 373 icons, ISC.

- https://api.iconify.design/collections?prefixes=lucide-lab

**Claim:** shadcn-svelte's CLI supports five `iconLibrary` values: `lucide` (`@lucide/svelte`), `tabler` (`@tabler/icons-svelte`), `hugeicons` (`@hugeicons/svelte` + `@hugeicons/core-free-icons`), `phosphor` (`phosphor-svelte`), `remixicon` (`remixicon-svelte`). Its agent rule: "Always use the project's configured `iconLibrary` for imports."

- https://github.com/huntabyte/shadcn-svelte/blob/main/packages/cli/src/icons/libraries.ts
- https://github.com/huntabyte/shadcn-svelte/blob/main/skills/shadcn-svelte/rules/icons.md

### 1.2 Alternatives

| Set                          | Icons (Iconify count)                                                   | Svelte 5 package (latest, date)                                                                                                                                 | Licence                                    | Repo activity                                                    | Notes                                                                     |
| ---------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Lucide**                   | 1,853 (repo: 1,854 SVGs)                                                | `@lucide/svelte` 1.48.0, 2026-09-24, peer `svelte ^5`                                                                                                           | ISC (+MIT subset)                          | pushed 2026-09-24                                                | shadcn default; per-icon subpath imports                                  |
| **Tabler**                   | 6,202 (README: "6220 free, MIT-licensed… 24x24 grid with a 2px stroke") | `@tabler/icons-svelte-runes` 3.48.0, 2026-09-22, peer `svelte ^5.0.0`; `@tabler/icons-svelte` 3.48.0                                                            | MIT                                        | pushed 2026-09-22                                                | Same grid/stroke family as Lucide; shadcn-svelte option                   |
| **Phosphor**                 | 9,072 (≈6 weights per glyph)                                            | `phosphor-svelte` 3.1.0, 2026-01-24, peer `svelte ^5` (community port)                                                                                          | MIT                                        | port pushed 2026-09-22; `@phosphor-icons/core` pushed 2026-01-06 | Weights: thin/light/regular/bold/fill/duotone; shadcn-svelte option       |
| **Hugeicons (free)**         | 6,065                                                                   | `@hugeicons/svelte` 1.1.5, 2026-08-21, peer `svelte ^5` + `@hugeicons/core-free-icons` 4.3.5                                                                    | MIT (free set); Pro is separately licensed | pushed 2026-09-23                                                | Renderer + data object (`<HugeiconsIcon icon={X}>`); shadcn-svelte option |
| **Heroicons v2**             | 1,288 (4 variants per glyph)                                            | **No first-party Svelte package** (first-party React and Vue only); community `svelte-hero-icons` 5.2.0 (2024-07-16), `@steeze-ui/heroicons` 2.4.2 (2024-11-20) | MIT                                        | `heroicons` 2.2.0 released 2024-11-18; repo pushed 2026-05-12    | Not a shadcn-svelte option                                                |
| **Material Symbols**         | 15,717 (across Outlined/Rounded/Sharp × fill)                           | No official Svelte package; `@material-symbols/svg-400` 0.47.5 (community, 2026-09-22) or the variable font                                                     | Apache-2.0                                 | google/material-design-icons pushed 2026-09-18                   | Variable axes FILL/wght/GRAD/opsz                                         |
| **Iconify / unplugin-icons** | 200,000+ across 150+ sets                                               | `@iconify/svelte` 5.2.2 (2026-06-11, peer `svelte >5.0.0`); `unplugin-icons` 24.0.0 (2026-09-11, supports Svelte)                                               | MIT (tools); per-set licences              | both pushed Sept 2026                                            | Meta-layer, not a style                                                   |

Sources for the table:

- Counts/licences: https://api.iconify.design/collections?prefixes=lucide,heroicons,ph,tabler,material-symbols,hugeicons,lucide-lab
- npm: https://registry.npmjs.org/@tabler/icons-svelte-runes, https://registry.npmjs.org/@tabler/icons-svelte, https://registry.npmjs.org/phosphor-svelte, https://registry.npmjs.org/@hugeicons/svelte, https://registry.npmjs.org/@hugeicons/core-free-icons, https://registry.npmjs.org/heroicons, https://registry.npmjs.org/svelte-hero-icons, https://registry.npmjs.org/@steeze-ui/heroicons, https://registry.npmjs.org/@material-symbols/svg-400, https://registry.npmjs.org/@iconify/svelte, https://registry.npmjs.org/unplugin-icons
- GitHub activity: https://api.github.com/repos/tabler/tabler-icons, https://api.github.com/repos/haruaki07/phosphor-svelte, https://api.github.com/repos/phosphor-icons/core, https://api.github.com/repos/hugeicons/hugeicons, https://api.github.com/repos/tailwindlabs/heroicons, https://api.github.com/repos/google/material-design-icons, https://api.github.com/repos/iconify/iconify, https://api.github.com/repos/unplugin/unplugin-icons
- Tabler README: https://github.com/tabler/tabler-icons/blob/main/README.md

**Claim (Tabler):** `@tabler/icons-svelte-runes` "is built for **Svelte 5** and uses the runes reactivity system"; "unused icons are tree-shaken from your bundle"; icons typed as Svelte 5 `Component<IconProps>`. shadcn-svelte deep-imports Tabler icons because "the package barrel… re-exports ~6k components and is extremely slow to load in Vite dev".

- https://github.com/tabler/tabler-icons/blob/main/packages/icons-svelte-runes/README.md
- https://github.com/huntabyte/shadcn-svelte/blob/main/packages/cli/src/icons/libraries.ts

**Claim (Phosphor):** `phosphor-svelte` recommends per-file imports (`phosphor-svelte/lib/CubeIcon`) and warns named imports may compile slowly; `weight` can toggle state (e.g. `regular` → `fill`); components accept SVG children such as `<animate>`/`<animateTransform>`.

- https://github.com/haruaki07/phosphor-svelte/blob/master/README.md

**Claim (Hugeicons):** Free package "includes 6,000+ Stroke Rounded icons"; Pro "60,000+ icons across 10 styles" requires a licence. The component takes an icon data object plus optional `altIcon`/`showAlt` for state swaps. Free icons are MIT.

- https://github.com/hugeicons/hugeicons/blob/HEAD/packages/svelte/README.md
- https://github.com/hugeicons/hugeicons/blob/HEAD/packages/core-free-icons/LICENSE.md

**Claim (Heroicons):** "Available as basic SVG icons and via first-party React and Vue libraries." Latest release v2.2.0 on 2024-11-18.

- https://github.com/tailwindlabs/heroicons/blob/master/README.md
- https://github.com/tailwindlabs/heroicons/releases/tag/v2.2.0

**Claim (Material Symbols):** "over 2,500 icons" in one variable font with four axes (fill, weight, grade, optical size); Apache 2.0; "To convey a state transition, use the fill axis for animation or interaction."

- https://developers.google.com/fonts/docs/material_symbols

**Claim (Iconify):** `@iconify/svelte` loads icon data on demand from the public Iconify API by default ("One syntax for over 200,000 icons from 150+ icon sets"); icon data can also be passed directly for offline use. Names are `prefix:name` (e.g. `mdi-light:home`).

- https://github.com/iconify/iconify/blob/main/components/svelte/README.md

**Claim (unplugin-icons):** Imports use `~icons/{collection}/{icon}` and "Only bundle the icons you really use"; SvelteKit is supported with `compiler: 'svelte'`. Because the path is resolved at build time, it is a static-import tool.

- https://github.com/unplugin/unplugin-icons/blob/main/README.md

**Claim:** `@iconify-json/lucide` 1.2.136 (2026-09-22, ISC) packages all Lucide icon bodies as one JSON (1,925 entries in `icons` incl. deprecated/hidden, 219 aliases, ~612 kB unpacked) — usable as data for a searchable picker without importing Svelte components.

- https://registry.npmjs.org/@iconify-json/lucide
- https://cdn.jsdelivr.net/npm/@iconify-json/lucide@1.2.136/icons.json

---

## 2. Animated icon options

### 2.1 Lucide's own stance

**Claim:** Official animated icons are "Unlikely to be added" (Lucide member jguddas, issue #3045, 2025-04-14), pointing instead to pqoqubbw's set and jis3r's "moving icons".

- https://github.com/lucide-icons/lucide/issues/3045

### 2.2 moving icons (`@jis3r/icons`) — Svelte port of animated Lucide

**Claim:** "A collection of 500+ hand-crafted, interaction-ready Lucide icons. Built natively for Svelte 5 with zero dependencies. Fully tree-shakeable, MIT licensed." npm `@jis3r/icons` 2.9.0 (2026-07-30), peer `svelte ^5.0.0`, no dependencies. Repo `jis3r/icons` MIT, pushed 2026-09-15; `src/lib/icons` has 557 entries.

- https://github.com/jis3r/icons/blob/master/README.md
- https://registry.npmjs.org/@jis3r/icons
- https://api.github.com/repos/jis3r/icons

**Claim:** Install options: npm; **shadcn-svelte registry** (`npx shadcn-svelte@latest add https://movingicons.dev/r/[icon-name]`, copied into `src/lib/components/movingicons`); or copy from the site. Single-icon subpath imports (`@jis3r/icons/icons/bell`) avoid the barrel.

- https://github.com/jis3r/icons/blob/master/README.md

**Claim (trigger):** Each icon self-animates on pointer hover (one-shot ~200–1500 ms, a few loop while hovered). An `animate` prop is OR-ed with hover so a parent can trigger it; "There is currently no prop to disable the built-in hover trigger."

- https://github.com/jis3r/icons/blob/master/README.md

**Claim (implementation):** Animations are plain scoped CSS. E.g. `settings.svelte` sets `transition: transform 1s …` and toggles a class to `rotate(180deg)`; the SVG is wrapped in `<div role="img" aria-label="settings">` with `onmouseenter`/`onmouseleave`.

- https://github.com/jis3r/icons/blob/master/src/lib/icons/settings.svelte

**Claim (a11y limitations, stated by the project):** Every icon renders `role="img" aria-label="<lucide-name>"` that "is always present and can't be removed via props"; decorative use needs a wrapping `aria-hidden`. "Known limitation: animations do not currently respect `prefers-reduced-motion`."

- https://github.com/jis3r/icons/blob/master/README.md (section "Accessibility")

**Claim (terms):** README "Terms of Use": free for personal/commercial projects but tutorials/demos "cannot be redistributed or resold" — alongside the MIT LICENSE.

- https://github.com/jis3r/icons/blob/master/README.md

_(inference)_ The wrapper is a `<div>` (`display: inline-block`), and a `<div>` is not phrasing content, so placing an icon inside a `<button>` or `<a>` inline is invalid HTML. Vendored copies should swap the wrapper for a `<span>` (see `copy.svelte`: https://github.com/jis3r/icons/blob/master/src/lib/icons/copy.svelte).

_(inference)_ Because the animations are CSS transitions/keyframes, VMB's global reduced-motion rule (`transition-duration: 0.01ms !important`) would collapse them to an instant state change even though the library itself ignores the preference.

**Coverage check against VMB icons** (checked against `src/lib/icons` file list, https://github.com/jis3r/icons/tree/master/src/lib/icons): present — `settings`, `cog`, `clipboard-check`, `house`, `rocket`, `shield-check`, `shopping-cart`, `user`, `users`, `refresh-cw`, `check`, `circle-check`, `trash-2`, `bell`, `search`, `plus`, `pencil`, `log-out`, `copy`, `triangle-alert`, `download`, `upload`, `file-text`, `layout-dashboard`, `chevron-down`, `x`. **Missing** — `truck`, `box`, `package`, `warehouse`, `banknote`, `building`, `building-2`, `monitor`, `megaphone`, `scale`, `shapes`, `menu`, `loader-circle`.

### 2.3 lucide-animated (pqoqubbw/icons) and the npm name-alike

**Claim:** `pqoqubbw/icons` ("`lucide-animated` is beautifully crafted animated icons", demo lucide-animated.com) is MIT, pushed 2026-08-22, ~8.1k stars; its components are **React + `motion/react`** (`"use client"`, `motion`, `useAnimation`), 467 `.tsx` icons, distributed via a shadcn registry. README lists the Svelte port as movingicons.dev by @jis3r.

- https://github.com/pqoqubbw/icons/blob/main/README.md
- https://github.com/pqoqubbw/icons/blob/main/LICENSE
- https://github.com/pqoqubbw/icons/blob/main/icons/truck.tsx
- https://github.com/pqoqubbw/icons/blob/main/package.json

**Claim (site, checked 2026-09-24):** lucide-animated.com installs one icon at a time through the React shadcn CLI (`npx shadcn@latest add "https://lucide-animated.com/r/activity.json"`, written to `components/icons/<name>.tsx`, adding Motion as a dependency) and "animates on hover". It links community ports for Svelte (movingicons.dev, @jis3r, §2.2), Vue, Angular and Flutter. The only Svelte option it lists is movingicons.dev.

- https://lucide-animated.com/

**Claim:** The npm package named `lucide-animated` (1.0.5, 2026-06-27, peer `react >=18`, `motion >=11`) is a **different** project (maintainer `marciomrb`, demo lucide-animated.vercel.app), React-only.

- https://registry.npmjs.org/lucide-animated

### 2.4 Animate UI

**Claim:** "A fully animated, open-source component distribution built with React, TypeScript, Tailwind CSS, and Motion." Licence file is "MIT + Commons Clause" (no selling/redistributing the components themselves). Repo pushed 2025-12-31. No Svelte package found (`@animate-ui/svelte` does not exist on npm; GitHub search for "animate-ui svelte" returned nothing).

- https://github.com/imskyleen/animate-ui/blob/main/README.md
- https://github.com/imskyleen/animate-ui/blob/main/LICENSE.md
- https://registry.npmjs.org/@animate-ui/svelte (404)

### 2.5 Lordicon

**Claim:** `@lordicon/web` 2.0.0 (2026-09-23, MIT) is a framework-agnostic JS player for Lordicon's Lottie-JSON icons; you call `player.play()` from your own events (e.g. `pointerenter`); icons carry named states (`in-reveal`, `hover-jump`, `morph-*`), recolourable, stroke `light/regular/bold`.

- https://github.com/lordicondev/player-web/blob/main/README.md
- https://registry.npmjs.org/@lordicon/web

**Claim:** Free icons use a modified "Attribution-NoDerivatives 4.0 International" licence — "Author attribution (credit needed) required"; PRO removes attribution. Library size "47,900+" icons. Visual style is Lordicon's own (not Lucide's).

- https://lordicon.com/licenses

**UNCONFIRMED:** Lordicon player bundle size and any built-in reduced-motion handling (not stated in the README).

### 2.6 useAnimations

**Claim:** `react-useanimations` 2.10.0, last published 2022-12-27, peer `react`/`react-dom` — React-only and inactive (repo pushed 2024-06-12).

- https://registry.npmjs.org/react-useanimations
- https://api.github.com/repos/useAnimations/react-useanimations

### 2.7 Lottie (lottie-web, dotLottie)

**Claim:** `lottie-web` 5.13.0 last published 2025-05-21 (MIT; repo last pushed 2025-09-01).

- https://registry.npmjs.org/lottie-web
- https://api.github.com/repos/airbnb/lottie-web

**Claim:** `@lottiefiles/dotlottie-svelte` 0.10.15 (2026-08-28, peer `svelte ^5.0.0`, MIT) wraps the `dotlottie-web` player (0.80.0). The player's "WASM engine (~500 KB compressed) is fetched from a CDN when the first player is constructed"; self-hosting needs `setWasmUrl()` and CSP consideration. Triggers are props/`autoplay`/`loop` and a player API.

- https://github.com/LottieFiles/dotlottie-web/blob/main/packages/svelte/README.md
- https://github.com/LottieFiles/dotlottie-web/blob/main/packages/web/README.md
- https://registry.npmjs.org/@lottiefiles/dotlottie-svelte

**UNCONFIRMED:** built-in `prefers-reduced-motion` handling in dotLottie (not found in the READMEs checked).

### 2.8 Rive

**Claim:** Rive web runtime is open source (`rive-app/rive-wasm`, MIT; `@rive-app/canvas`/`webgl2` 2.43.1, 2026-09-23); `@rive-app/webgl2` is recommended and `@rive-app/canvas-lite` is a smaller variant. Docs mention Svelte only as a wrapper one _could_ build — no official Svelte runtime. Docs include a "Reduced Motion Example".

- https://rive.app/docs/runtimes/web/web-js
- https://registry.npmjs.org/@rive-app/canvas
- https://api.github.com/repos/rive-app/rive-wasm

### 2.9 Motion (motion.dev)

**Claim:** Motion is "An open source animation library for JavaScript, React and Vue" (no Svelte package). `motion` 13.4.2 (2026-09-23, MIT) has React as an **optional** peer, so its vanilla `animate()` works in any framework. `animate()` is 2.3 kB (mini, native browser APIs) or 18 kB (hybrid).

- https://github.com/motiondivision/motion/blob/main/README.md
- https://registry.npmjs.org/motion (`peerDependenciesMeta`)
- https://motion.dev/docs/animate
- https://motion.dev/docs/quick-start

**Claim:** Community `@humanspeak/svelte-motion` 1.2.1 (2026-09-09, peer `svelte ^5`, MIT, ~100 stars); older `svelte-motion` 0.12.2 last published 2024-02-27.

- https://registry.npmjs.org/@humanspeak/svelte-motion
- https://registry.npmjs.org/svelte-motion

**UNCONFIRMED:** Motion's reduced-motion handling for vanilla `animate()` (not stated on the pages fetched).

### 2.10 Svelte built-ins

**Claim:** `svelte/motion` exports `Spring` (since 5.8.0), `Tween`, and `prefersReducedMotion` (since 5.7.0), a reactive media query — example: `transition:fly={{ y: prefersReducedMotion.current ? 0 : 200 }}`.

- https://svelte.dev/docs/svelte/svelte-motion

**Claim:** `svelte/transition` `draw` "Animates the stroke of an SVG element… only works with elements that have a `getTotalLength` method, like `<path>` and `<polyline>`."

- https://svelte.dev/docs/svelte/svelte-transition

**Claim (important for ADR-0035 rule 6):** "Transitions are driven by the Web Animations API rather than by CSS. A global `@media (prefers-reduced-motion: reduce)` rule that zeroes `transition-duration` and `animation-duration` therefore has no effect on them." Use `prefersReducedMotion` instead. The runtime calls `element.animate(...)`.

- https://svelte.dev/docs/svelte/transition (section "Accessibility")
- https://github.com/sveltejs/svelte/blob/main/packages/svelte/src/internal/client/dom/elements/transitions.js

_(inference)_ The same applies to Motion's `animate()` (which also uses the Web Animations API per https://motion.dev/docs/animate) and to Lottie/Rive/Lordicon players: VMB's global CSS collapse does **not** cover them.

### 2.11 Plain CSS / SVG techniques

**Claim:** `stroke-dashoffset` is a presentation attribute with a CSS property counterpart and is animatable; `pathLength` lets authors declare a path's total length so dash calculations scale to it (works on `path`, `circle`, `line`, `polyline`, `rect`, etc.) — the basis of "draw-on" stroke animations.

- https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dashoffset
- https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/pathLength

**Claim:** Tailwind ships `animate-spin` ("for loading indicators") and `motion-safe:` / `motion-reduce:` variants to apply animations only when the user has/hasn't requested reduced motion.

- https://github.com/tailwindlabs/tailwindcss.com/blob/main/src/docs/animation.mdx (https://tailwindcss.com/docs/animation)

**Claim:** Animated SVG sets exist on Iconify: `line-md` (Material Line Icons, 1,218, MIT) and `svg-spinners` (46, MIT).

- https://api.iconify.design/collections?prefixes=line-md,svg-spinners

### 2.12 Summary table

| Option                               | Svelte 5             | Cost                                            | Licence                | Trigger                            | Reduced motion                                                    |
| ------------------------------------ | -------------------- | ----------------------------------------------- | ---------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| moving icons `@jis3r/icons`          | Native               | Zero deps; per-icon CSS                         | MIT (+ README terms)   | Hover (always on) + `animate` prop | Not handled by lib; CSS so global rule collapses it _(inference)_ |
| pqoqubbw lucide-animated             | No (React + Motion)  | —                                               | MIT                    | Hover / imperative handle          | —                                                                 |
| Animate UI                           | No (React)           | —                                               | MIT + Commons Clause   | —                                  | —                                                                 |
| Lordicon                             | Via vanilla player   | Player + Lottie JSON per icon; size UNCONFIRMED | Free = attribution, ND | Your events + states               | UNCONFIRMED                                                       |
| useAnimations                        | No (React, inactive) | —                                               | MIT                    | —                                  | —                                                                 |
| dotLottie                            | `dotlottie-svelte`   | ~500 KB WASM                                    | MIT                    | Props / player API                 | UNCONFIRMED                                                       |
| Rive                                 | Vanilla runtime only | WASM runtime; size UNCONFIRMED                  | MIT runtime            | State machines                     | Docs have an example                                              |
| Motion `animate()`                   | Vanilla              | 2.3 kB / 18 kB                                  | MIT                    | Imperative                         | UNCONFIRMED; WAAPI not covered by CSS rule _(inference)_          |
| Svelte `transition`/`Spring`/`Tween` | Built in             | 0                                               | MIT                    | Mount/unmount, state               | Must use `prefersReducedMotion` explicitly                        |
| CSS / SVG stroke / Tailwind          | Any                  | 0                                               | —                      | Class/state/hover                  | `motion-safe:`/global CSS rule                                    |

---

## 3. UX and accessibility guidance

**Claim (WCAG 2.2 SC 2.3.3 Animation from Interactions, Level AAA):** "Motion animation triggered by interaction can be disabled, unless the animation is essential to the functionality or the information being conveyed." Motion animation excludes changes of colour or opacity that do not change perceived size, shape or position (an erratum removed blur from that exclusion). Technique C39: use `prefers-reduced-motion`.

- https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html

**Claim (WCAG 2.2 SC 2.2.2 Pause, Stop, Hide, Level A):** moving/blinking content that "starts automatically, lasts more than five seconds, and is presented in parallel with other content" needs a pause/stop/hide mechanism unless essential. A preload-phase animation "can be considered essential if interaction cannot occur during that phase… and if not indicating progress could confuse users".

- https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html

**Claim (Media Queries Level 5):** `prefers-reduced-motion: reduce` "Indicates that user has notified the system that they prefer an interface that removes or replaces the types of motion-based animation that either trigger discomfort for those with vestibular motion sensitivity, or distraction for those with attention deficits."

- https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion

**Claim (MDN):** Baseline widely available since January 2020; `reduce` signals a preference to minimise _non-essential_ motion — i.e. reduce/replace, not necessarily remove all feedback.

- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion

**Claim (Carbon):** Two styles — _productive_ motion ("subtle and out of the way… appropriate for moments when the user needs to focus on completing tasks", e.g. button states, dropdowns, data tables) and _expressive_ motion "for occasional, important moments". Checklist: micro-interactions "within a static duration ranging from 90–120 ms"; "Is your motion frequently noticed by average users? If so, consider removing or minimizing it"; "Make sure there is always a way to communicate similar messages statically." Duration tokens: 70 ms (button/toggle) to 240 ms (toast).

- https://github.com/carbon-design-system/carbon-website/blob/main/src/pages/elements/motion/overview.mdx (https://carbondesignsystem.com/elements/motion/overview/)

**Claim (Carbon icons):** Interactive icon touch targets 44px+; Carbon publishes an animated-icon collection (`@carbon/icons-motion`, React, Apache-2.0) where the app sets `isAnimating` to trigger — i.e. animation is opt-in per use.

- https://github.com/carbon-design-system/carbon-website/blob/main/src/pages/elements/icons/usage.mdx
- https://github.com/carbon-design-system/icons-motion/blob/main/README.md

**Claim (Atlassian):** "Motion helps users understand what changed, why it changed, and what to do next"; "Motion is a clarifying layer, not decoration"; "Respect reduced motion settings. Currently, when reduced motion is active, motion is off and instant." Iconography: "Use text labels to support icons wherever possible, and avoid using icons where they aren't necessary."

- https://atlassian.design/foundations/motion
- https://atlassian.design/foundations/iconography

**Claim (Lucide a11y guide):** "Icons can improve scanning, but they aren't a replacement for text"; don't rely on colour alone; interactive icons wrapped in semantic, focusable elements; target ≥ 44×44 px on the wrapper.

- https://github.com/lucide-icons/lucide/blob/main/docs/how-to/accessibility.md (https://lucide.dev/how-to/accessibility)

**Claim (Material):** Material Symbols guidance: use the FILL axis to convey a state transition.

- https://developers.google.com/fonts/docs/material_symbols

**UNCONFIRMED:** Material Design 3 motion guidance text (m3.material.io renders client-side; content could not be fetched).

**UNCONFIRMED:** Apple HIG "Motion" and "SF Symbols → Animations" guidance (developer.apple.com timed out / TLS error on every attempt). A search-result snippet for https://developer.apple.com/sf-symbols/ described symbol animations (Bounce, Wiggle, Rotate, Breathe…) that "respond to user input, convey status changes, and signal ongoing activity", but the page itself was not retrieved.

---

## 4. Stored `icon_name` values: options going forward

Repo/legacy facts:

- Legacy uses `TomatoPHP\FilamentIcons\Components\IconPicker` for `icon_name` on Divisions and **Warehouse Items** (not only Divisions/Roles); the package lets apps register extra icon libraries (e.g. boxicons).
  - https://github.com/ubeann/vmb-warehouse/blob/development/app/Filament/Resources/Master/Divisions/DivisionResource.php
  - https://github.com/ubeann/vmb-warehouse/blob/development/app/Filament/Resources/Warehouse/Items/ItemResource.php
  - https://github.com/tomatophp/filament-icons/blob/master/README.md
- Legacy seeders use `heroicon-o-` banknotes, briefcase, building-office-2, code-bracket, cog, currency-dollar, shield-check, truck, user, user-group. **`briefcase`, `code-bracket` and `currency-dollar` are not in `hero-icons.ts`**, so they currently render the `shapes` fallback.
  - https://github.com/ubeann/vmb-warehouse/blob/development/database/seeders/Master/RolesSeeder.php
  - https://github.com/ubeann/vmb-warehouse/blob/development/database/seeders/Master/DivisionsSeeder.php
- `warehouse_items.icon_name` defaults to `heroicon-o-cube` and was already flagged "convert `icon_name` to a constrained picker value" (`docs/research/legacy-schema-inventory.md` §Items).
- In the rebuild, `DivisionForm.svelte`/`RoleForm.svelte` expose `iconName` as a free-text `<input>`; the Zod schema (`packages/types/src/roles.ts`) only checks 1–255 chars, default `heroicon-o-rocket-launch`.
- **UNCONFIRMED:** the full set of distinct `icon_name` values in production (`vmb_prod`); only seeders were checked. A `SELECT DISTINCT icon_name` per table is needed before any mapping is declared complete.

| Option                                                | How                                                                                                                                                                                        | Pros                                                                                                              | Cons                                                                                                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Keep Heroicons names + mapping** (status quo)    | Picker offers Heroicons names; `HeroIcon` maps to Lucide                                                                                                                                   | No data migration; legacy app can still read rows during parallel run                                             | Picker would list names we then _don't_ draw; mapping grows without bound; every picked icon needs a mapping entry or silently shows `shapes`; two vocabularies forever                                            |
| **B. Store Lucide names, curated allowlist**          | Migrate rows once (`heroicon-o-truck` → `truck`); shared Zod enum of ~40–80 domain icons in `packages/types`; static import map in one component                                           | Tree-shaking kept (static imports); validation at API + form; picker is small and searchable; name = what renders | Needs a one-off data migration and a fallback for unknowns; adding an icon is a code change                                                                                                                        |
| **C. Store Lucide names, full set**                   | Any of ~1,850 names; render via `import.meta.glob` over `@lucide/svelte/dist/icons/*.js` (lazy chunks) or the `icons` barrel; picker data from `@iconify-json/lucide` or Lucide's tag JSON | Maximum choice; picker search by tags                                                                             | Lucide itself warns about build time, per-icon requests and flashing for dynamic icons; SSR needs care; barrel import defeats tree-shaking; names can be renamed/deprecated across Lucide versions (aliases exist) |
| **D. Prefixed names** (`lucide:truck`, Iconify-style) | As B/C with a set prefix                                                                                                                                                                   | Survives a future set change; legacy `heroicon-*` rows remain distinguishable                                     | Slightly more parsing; still need B's or C's rendering strategy                                                                                                                                                    |

Sources for the mechanics in the table: Lucide dynamic-icon caveats https://github.com/lucide-icons/lucide/blob/main/docs/guide/react/advanced/dynamic-icon-component.md; Vite: "Matched files are by default lazy-loaded via dynamic import and will be split into separate chunks during build" https://vite.dev/guide/features#glob-import; Iconify naming https://github.com/iconify/iconify/blob/main/components/svelte/README.md; Lucide aliases export https://github.com/lucide-icons/lucide/blob/main/packages/svelte/src/lucide-svelte.ts.

---

## Recommendation (opinion, not a cited fact)

1. **Keep Lucide; do not switch sets.** It is actively maintained (release today), Svelte-5 native, tree-shakes per icon, is shadcn-svelte's default and the style ADR-0035 already commits to. Heroicons v2 is a step backwards (≈322 glyphs, no first-party Svelte package, last release Nov 2024). Tabler/Phosphor/Hugeicons offer 3–5× more glyphs, but switching `iconLibrary` means re-adding every registry component and amending ADR-0035 for no admin-UX gain. If a warehouse glyph is missing, check Lucide Lab first, then consider Tabler (same 24px/2px stroke) for that single icon.

2. **Animate sparingly, only where motion carries meaning.** For a data-dense admin tool the evidence (Carbon "productive" motion, Atlassian "not decoration", WCAG 2.3.3/2.2.2) points to: state-change feedback (copy → check, save → check-draw, refresh spinning while fetching, bell on new notification), loading, and at most a subtle hover cue in the sidebar nav. No looping or auto-playing decorative icons, no animated icons in table rows or domain badges (division/role/item icons stay static).

3. **Implementation: CSS-first, no new runtime.** Use Tailwind (`motion-safe:animate-spin` on `loader-circle`), CSS transitions and SVG `pathLength` + `stroke-dashoffset` on the existing Lucide components. If richer hover icons are wanted, pull a _small_ curated set from **moving icons** via its shadcn-svelte registry (copied source, Svelte 5, MIT, CSS-only), into `$lib/components/movingicons`, and patch the copies to (a) drop the forced `role="img"`/`aria-label` in favour of ADR-0035's `aria-hidden` default and (b) let the parent row/button drive `animate` instead of the icon's own hover. It lacks VMB's domain glyphs (truck, box, warehouse, banknote), which is fine given point 2. Skip Lottie/dotLottie (500 KB WASM), Rive, Lordicon (attribution, different style) and the React-only sets.

4. **Tighten ADR-0035 rule 6.** The global CSS collapse does not reach Svelte transitions (Web Animations API, per Svelte's own docs) or any JS/WAAPI animation. Amend the rule: any `transition:`/`animate:`/`Tween`/`Spring` use must read `prefersReducedMotion` from `svelte/motion`. Also note that under the current rule a spinner freezes after one frame, so every loading indicator must carry text ("Loading…"/`aria-busy`) rather than rely on motion.

5. **Stored names: move to Option B (Lucide names, curated allowlist), optionally with D's prefix.** Do it as part of the Master/Items tickets: query distinct `icon_name` values in `vmb_prod`, extend the mapping to cover every one (at least add `briefcase`, `code-bracket` → `code`, `currency-dollar` → `circle-dollar-sign`, `cube` → `box`), migrate rows to Lucide names, replace the free-text input with a searchable icon picker (icon + name, keyboard-navigable, the value shown as text), and validate with a shared Zod enum. Keep `heroiconToLucide` only as a read-time fallback until the migration has run, then delete it. If migration must wait for cutover, ship the picker writing Lucide names now and let `HeroIcon` accept both formats.
