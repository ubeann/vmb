import { describe, expect, it } from "vitest";
import { summarizeCspReport } from "./csp-report.js";

describe("summarizeCspReport (ADR-0047)", () => {
  it("reads a report-to batch and cuts URLs to origin and path", () => {
    const violations = summarizeCspReport([
      {
        type: "csp-violation",
        url: "https://vmb.example/activate?email=a@example.com",
        body: {
          documentURL: "https://vmb.example/activate?email=a@example.com",
          blockedURL: "https://evil.example/x.js?token=secret",
          effectiveDirective: "script-src-elem",
          sourceFile: "https://vmb.example/_app/immutable/entry/app.js",
          lineNumber: 12,
          disposition: "report",
          sample: ""
        }
      },
      { type: "deprecation", body: { id: "ignored" } }
    ]);

    expect(violations).toEqual([
      {
        directive: "script-src-elem",
        blocked: "https://evil.example/x.js",
        document: "https://vmb.example/activate",
        source: "https://vmb.example/_app/immutable/entry/app.js",
        line: 12,
        disposition: "report",
        sample: ""
      }
    ]);
  });

  it("reads a legacy report-uri report and keeps keyword sources", () => {
    const [violation] = summarizeCspReport({
      "csp-report": {
        "document-uri": "https://vmb.example/login",
        "blocked-uri": "inline",
        "violated-directive": "style-src-elem",
        disposition: "report",
        "script-sample": "x".repeat(100)
      }
    });

    expect(violation).toMatchObject({
      directive: "style-src-elem",
      blocked: "inline",
      document: "https://vmb.example/login",
      line: null,
      sample: "x".repeat(40)
    });
  });

  it("reduces a data: URL to its scheme", () => {
    const [violation] = summarizeCspReport([
      { type: "csp-violation", body: { blockedURL: "data:image/png;base64,AAAA" } }
    ]);

    expect(violation!.blocked).toBe("data:");
  });

  it("keeps at most ten violations from one batch", () => {
    const batch = Array.from({ length: 50 }, () => ({ type: "csp-violation", body: {} }));

    expect(summarizeCspReport(batch)).toHaveLength(10);
  });

  it.each([null, "text", 42, { other: true }, [{ type: "csp-violation", body: "x" }]])(
    "finds nothing in %j",
    (payload) => {
      expect(summarizeCspReport(payload)).toEqual([]);
    }
  );
});
