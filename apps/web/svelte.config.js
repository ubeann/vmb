import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// sha256 of the <style> text mode-watcher 1.1.0 appends in withoutTransition.
export const MODE_WATCHER_STYLE_HASH = "sha256-OWM7eqRFZQb+Ir51EYZz6GAUUG4Oy2fNwCWX0peasbE=";

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
    outDir: process.env.SVELTE_KIT_OUT_DIR || ".svelte-kit",
    // ADR-0047. Report-only until production reports come back clean, then
    // this set moves to `directives`. `auto` means a per-request nonce, since
    // nothing is prerendered; SvelteKit adds it to script-src and
    // style-src-elem. Style attributes stay allowed: server-rendered `style=`
    // and bits-ui's `setAttribute("style")` scroll-lock reset need them, and
    // Safari before 26.2 ignores style-src-elem and reads style-src.
    csp: {
      mode: "auto",
      reportOnly: {
        "default-src": ["self"],
        "script-src": ["self"],
        "style-src": ["self", "unsafe-inline"],
        // The hash is mode-watcher's `* { transition: none }` sheet, added while
        // the scheme changes (MODE_WATCHER_STYLE_HASH; csp.test.ts re-derives it).
        "style-src-elem": ["self", MODE_WATCHER_STYLE_HASH],
        "style-src-attr": ["unsafe-inline"],
        "img-src": ["self"],
        // Vite inlines font subsets under 4 kB (a JetBrains Mono one) as data: URLs.
        "font-src": ["self", "data:"],
        "connect-src": ["self"],
        "object-src": ["none"],
        "base-uri": ["self"],
        "form-action": ["self"],
        "frame-ancestors": ["none"],
        // report-to names the endpoint in the Reporting-Endpoints header that
        // hooks.server.ts sets; report-uri is for browsers without report-to.
        "report-to": ["csp"],
        "report-uri": ["/csp-report"]
      }
    }
  }
};

export default config;
