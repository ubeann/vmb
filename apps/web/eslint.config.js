// @ts-check
import { baseConfig } from "@vmb/config/eslint.config.js";
import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";

export default [
  ...baseConfig,
  ...svelte.configs.recommended,
  {
    files: ["**/*.svelte"],
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
  { ignores: [".svelte-kit/**"] }
];
