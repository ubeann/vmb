import { sveltekit } from "@sveltejs/kit/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }]
          }
        }
      }
    ]
  }
});
