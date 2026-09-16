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
    }
  },
  { ignores: [".svelte-kit/**"] }
];
