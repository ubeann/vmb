import { sveltekit } from "@sveltejs/kit/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

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
  plugins: process.env.VITEST ? [] : [sveltekit()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.svelte.test.ts"]
        }
      },
      {
        extends: true,
        plugins: [sveltekit()],
        test: {
          name: "component",
          include: ["src/**/*.svelte.test.ts"],
          browser: {
            enabled: true,
            // CI drives the runner image's preinstalled Chrome: the browser
            // binary and its OS dependencies are already there, so the
            // `playwright install` steps disappear — 23 s of every run. Local
            // runs keep the Chromium the lockfile pins. The trade-off is
            // deliberate: CI tests the runner's Chrome version, which drifts
            // with the image (docs/ARCHITECTURE.md §9).
            provider: playwright({
              launchOptions: process.env.CI ? { channel: "chrome" } : {}
            }),
            headless: true,
            instances: [{ browser: "chromium" }]
          }
        }
      }
    ]
  }
});
