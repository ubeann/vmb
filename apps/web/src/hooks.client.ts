import { z } from "zod";

// zod probes `new Function("")` to decide whether it may compile parsers, and
// a CSP without 'unsafe-eval' files a violation report for that probe on every
// page load, even though zod catches the throw. jitless skips the probe; the
// forms' schemas are small enough not to miss the compiled path (ADR-0047).
z.config({ jitless: true });
