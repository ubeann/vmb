// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Shared base config; apps extend this and add framework-specific plugins. */
export const baseConfig = tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  ignores: ["dist/**", ".svelte-kit/**", "node_modules/**", "*.config.js"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
  }
});
