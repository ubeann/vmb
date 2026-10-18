import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit, type Config } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { csp } from "./csp.js";

// `std-env`'s rule: CI is on when the variable is set and not "false".
const onCi = !!process.env.CI && process.env.CI !== "false";

const stub = (file: string) => fileURLToPath(new URL(`./src/test-stubs/${file}`, import.meta.url));

// SvelteKit's config (kit 3 reads no svelte.config.js). Both sveltekit() calls
// below take this one object, so the component test project gets `outDir` too.
const kit: Config = {
  adapter: adapter(),
  // Turbo runs this package's build, typecheck and test in parallel (#286),
  // and each of them has SvelteKit write its generated files — ambient.d.ts,
  // generated/** — with content that depends on the mode it runs in. Sharing
  // one directory raced them. `build` and `test` set this to their own
  // directory in package.json; `typecheck` and `sync` keep `.svelte-kit`.
  outDir: process.env.SVELTE_KIT_OUT_DIR || ".svelte-kit",
  csp,
  // Kit 3 no longer generates `$lib`; its replacement is a `#lib` subpath
  // import. The deprecated `alias` keeps the 307 files that import `$lib`
  // working until that rename lands on its own.
  alias: { $lib: "src/lib" }
};

export default defineConfig({
  // SvelteKit reads PUBLIC_-prefixed vars through $env/*, but resolveApiUrl
  // reads import.meta.env.PUBLIC_API_URL directly so it stays a pure,
  // dependency-free function the node-environment unit tests can call. Expose
  // the prefix to Vite so `PUBLIC_API_URL=<url> vite build` (issue #23's
  // per-PR previews) is inlined into the bundle.
  envPrefix: ["VITE_", "PUBLIC_"],
  // sveltekit() opens an HMR websocket that vitest never closes, hanging test
  // teardown in the node-environment "unit" project below — only load it for
  // `vite dev`/`vite build` there. The browser-mode "component" project below
  // doesn't have this problem (different server/teardown lifecycle) and
  // needs sveltekit() anyway, to resolve $app/* imports in .svelte files.
  plugins: [tailwindcss(), ...(process.env.VITEST ? [] : [sveltekit(kit)])],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.svelte.test.ts"],
          // sveltekit-superforms 3's server entry starts with
          // `import '$app/server'`, and kit 3's own runtime imports
          // `#app/paths`. Inline both so Vite resolves those imports, and
          // point them at stubs: this project has no SvelteKit plugin to
          // provide the modules.
          server: { deps: { inline: ["sveltekit-superforms", "@sveltejs/kit"] } }
        },
        // The plugin defines this for kit's runtime; its cookie module reads it.
        define: { __SVELTEKIT_DEV__: "false" },
        // The same goes for the `$app/env` modules api-access.ts reads. Exact
        // matches, since "$app/env" is a prefix of "$app/env/private".
        resolve: {
          alias: [
            { find: /^\$app\/server$/, replacement: stub("app-server.ts") },
            { find: /^\$app\/env$/, replacement: stub("app-env.ts") },
            { find: /^\$app\/env\/private$/, replacement: stub("app-env-private.ts") },
            { find: /^#app\/paths$/, replacement: stub("app-paths.ts") }
          ]
        }
      },
      {
        extends: true,
        plugins: [sveltekit(kit)],
        test: {
          name: "component",
          include: ["src/**/*.svelte.test.ts"],
          browser: {
            enabled: true,
            // CI drives the runner image's preinstalled Chrome: the browser
            // binary and its OS dependencies are already there, so the two
            // `playwright install` steps it replaces — 5 s of cache restore
            // and 18 s of OS dependencies in the measured baseline — are gone.
            // Local runs keep the Chromium the lockfile pins. The trade-off is
            // deliberate: CI tests the runner's Chrome version, which drifts
            // with the image (docs/ARCHITECTURE.md §9, ADR-0021).
            provider: playwright({
              launchOptions: onCi ? { channel: "chrome" } : {}
            }),
            headless: true,
            instances: [{ browser: "chromium" }]
          }
        }
      }
    ]
  }
});
