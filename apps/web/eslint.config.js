// @ts-check
import { baseConfig } from "@vmb/config/eslint.config.js";

export default [
  ...baseConfig,
  // .svelte files are covered by `svelte-check` (typecheck) instead — no
  // eslint-plugin-svelte wired up yet for this vertical slice.
  { ignores: ["**/*.svelte", ".svelte-kit/**"] }
];
