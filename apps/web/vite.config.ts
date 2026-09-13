import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // sveltekit() opens an HMR websocket that vitest never closes, hanging test
  // teardown — only load it for `vite dev`/`vite build`, not `vitest run`.
  plugins: process.env.VITEST ? [] : [sveltekit()],
  test: {
    environment: "node"
  }
});
