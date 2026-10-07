// CSP violation reports, reduced to what triage needs (ADR-0047). Browsers
// send one of two shapes: the deprecated `report-uri` posts
// `{"csp-report": {...}}` as application/csp-report, and `report-to` posts an
// array of `{type: "csp-violation", body: {...}}` as application/reports+json.
// Anyone can post here, so every field is treated as hostile: capped, and
// URLs cut to origin and path so no query string (a token, an email) reaches
// the logs.
export const MAX_REPORT_BYTES = 16 * 1024;
const MAX_VIOLATIONS = 10;
const MAX_FIELD = 200;

export type CspViolation = {
  directive: string;
  blocked: string;
  document: string;
  source: string;
  line: number | null;
  disposition: string;
  sample: string;
};

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_FIELD) : "";
}

// `blockedURL` is often a keyword (`inline`, `eval`), not a URL; keep those.
function location(value: unknown): string {
  const raw = text(value);
  try {
    const url = new URL(raw);
    return url.protocol === "data:" ? "data:" : `${url.origin}${url.pathname}`.slice(0, MAX_FIELD);
  } catch {
    return raw;
  }
}

function violation(body: Fields, legacy: boolean): CspViolation {
  const pick = (modern: string, old: string) => body[legacy ? old : modern];
  const line = pick("lineNumber", "line-number");
  return {
    directive: text(
      pick("effectiveDirective", "effective-directive") ?? body["violated-directive"]
    ),
    blocked: location(pick("blockedURL", "blocked-uri")),
    document: location(pick("documentURL", "document-uri")),
    source: location(pick("sourceFile", "source-file")),
    line: typeof line === "number" && Number.isFinite(line) ? line : null,
    disposition: text(body.disposition),
    sample: text(pick("sample", "script-sample")).slice(0, 40)
  };
}

export function summarizeCspReport(payload: unknown): CspViolation[] {
  if (isFields(payload) && isFields(payload["csp-report"])) {
    return [violation(payload["csp-report"], true)];
  }
  if (!Array.isArray(payload)) return [];

  return payload
    .filter(
      (report): report is { body: Fields } =>
        isFields(report) && report.type === "csp-violation" && isFields(report.body)
    )
    .slice(0, MAX_VIOLATIONS)
    .map((report) => violation(report.body, false));
}
