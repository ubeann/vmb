// @ts-check
import { baseConfig } from "@vmb/config/eslint.config.js";
import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";

export default [
  ...baseConfig,
  ...svelte.configs.recommended,
  {
    // `.svelte.ts` modules (runes outside a component) go through the Svelte
    // parser too, so they need the TypeScript parser handed down as well.
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    },
    // svelte-check type-checks every component; no-undef cannot see DOM/TS type names.
    rules: { "no-undef": "off" }
  },
  {
    // Registry primitives forward `href` untouched; callers pass a resolve()d path.
    files: ["src/lib/components/ui/**"],
    rules: { "svelte/no-navigation-without-resolve": "off" }
  },
  {
    // Node tooling scripts and svelte.config.js (reads SVELTE_KIT_OUT_DIR); `document` appears
    // only inside Playwright page.evaluate callbacks.
    files: ["scripts/**/*.mjs", "svelte.config.js"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", document: "readonly" }
    }
  },
  { ignores: [".svelte-kit/**"] }
];
