import { MAX_REPORT_BYTES, readCapped, summarizeCspReport } from "$lib/server/csp-report.js";
import type { RequestHandler } from "./$types.js";

// Where browsers send CSP violation reports (ADR-0047): a line per report in
// the Workers logs, which is all the enforced policy and its report-only variant
// need. Public by necessity, so a report that is oversized or unreadable is
// dropped without a word.
export const POST: RequestHandler = async ({ request }) => {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_REPORT_BYTES) return new Response(null, { status: 413 });

  const raw = await readCapped(request.body);
  if (raw === null) return new Response(null, { status: 413 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }

  const violations = summarizeCspReport(payload);
  if (violations.length > 0) console.warn("csp-report", JSON.stringify(violations));

  return new Response(null, { status: 204 });
};
