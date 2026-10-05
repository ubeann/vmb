import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    // Turbo runs this package's build, typecheck and test in parallel (#286),
    // and each of them has SvelteKit write its generated files — ambient.d.ts,
    // generated/** — with content that depends on the mode it runs in. Sharing
    // one directory raced them. `build` and `test` set this to their own
    // directory in package.json; `typecheck` and `sync` keep `.svelte-kit`,
    // which tsconfig.json extends.
    outDir: process.env.SVELTE_KIT_OUT_DIR || ".svelte-kit"
  }
};

export default config;
