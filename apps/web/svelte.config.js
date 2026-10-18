import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// sha256 of the <style> text mode-watcher 1.1.0 appends in withoutTransition.
export const MODE_WATCHER_STYLE_HASH = "sha256-OWM7eqRFZQb+Ir51EYZz6GAUUG4Oy2fNwCWX0peasbE=";

// sha256 of the empty string: bits-ui's PinInput appends an empty <style> and fills
// it with insertRule, which CSP does not govern. Only the empty element matches.
export const EMPTY_STYLE_HASH = "sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=";

// What the enforced policy and the measured one share; each sets its own script-src.
const POLICY = {
  "default-src": ["self"],
  "style-src": ["self", "unsafe-inline"],
  // Two inline sheets are allowed by hash: mode-watcher's
  // `* { transition: none }`, added while the scheme changes, and the empty
  // <style> bits-ui's PinInput creates and fills through the CSSOM
  // (MODE_WATCHER_STYLE_HASH, EMPTY_STYLE_HASH; csp.test.ts re-derives both).
  "style-src-elem": ["self", MODE_WATCHER_STYLE_HASH, EMPTY_STYLE_HASH],
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
};

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
    // ADR-0047. Enforced: a browser check of every screen and overlay on a PR
    // preview found no unexplained violation (apps/web/scripts/csp-check.mjs).
    // `auto` means a per-request nonce, since nothing is prerendered;
    // SvelteKit adds it to script-src and style-src-elem. Style attributes stay
    // allowed: server-rendered `style=` and bits-ui's `setAttribute("style")`
    // scroll-lock reset need them, and Safari before 26.2 ignores
    // style-src-elem and reads style-src.
    csp: {
      mode: "auto",
      directives: { ...POLICY, "script-src": ["self"] },
      // The next step, measured and not enforced: scripts trusted by nonce and
      // what they load ('strict-dynamic' drops the host allowlist). It raised
      // no violation on a preview (csp-check.mjs --ignore-report-only), so it
      // can replace `directives`' script-src. Dropping style attributes was
      // measured too and fails on every page (ADR-0047); it is not kept here,
      // because each page view would then post its reports to /csp-report.
      reportOnly: { ...POLICY, "script-src": ["strict-dynamic"] }
    }
  }
};

export default config;
