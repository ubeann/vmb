// The response headers every Worker response carries (ADR-0047). Cloudflare
// Pages' `_headers` file never reaches what the Pages Function renders, so
// `handle` sets these; `apps/web/_headers` sets the same on static assets.
// The CSP itself comes from `csp` in csp.ts (vite.config.ts), on pages only.
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  // No `preload`: once a browser list carries it, it takes months to undo.
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
  // CSP frame-ancestors covers current browsers; this covers the rest.
  "x-frame-options": "DENY",
  // Where the CSP's `report-to csp` delivers. Resolved against the page's URL.
  "reporting-endpoints": 'csp="/csp-report"'
};

// Adds each header the response doesn't already set, so an endpoint's own
// choice (the avatar's CSP, say) wins. A response with immutable headers, such
// as one from `fetch` or `Response.redirect`, is copied first.
export function withSecurityHeaders(response: Response): Response {
  const missing = Object.entries(SECURITY_HEADERS).filter(([name]) => !response.headers.has(name));
  if (missing.length === 0) return response;

  try {
    for (const [name, value] of missing) response.headers.set(name, value);
    return response;
  } catch {
    const copy = new Response(response.body, response);
    for (const [name, value] of missing) copy.headers.set(name, value);
    return copy;
  }
}
