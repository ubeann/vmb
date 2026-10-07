import { describe, expect, it } from "vitest";
import { readCapped, summarizeCspReport } from "./csp-report.js";

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

  it("strips the query from a relative URL", () => {
    const [violation] = summarizeCspReport({
      "csp-report": { "document-uri": "/activate?email=private@example.com#code" }
    });

    expect(violation!.document).toBe("/activate");
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

describe("readCapped", () => {
  function chunked(...parts: string[]) {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(encoder.encode(part));
        controller.close();
      }
    });
  }

  it("reads a body within the limit, across chunks", async () => {
    await expect(readCapped(chunked('{"a":', '"é"}'), 16)).resolves.toBe('{"a":"é"}');
  });

  it("stops at the limit in bytes, not characters", async () => {
    // Four characters, eight UTF-8 bytes.
    await expect(readCapped(chunked("éééé"), 7)).resolves.toBeNull();
  });

  it("stops reading a chunked body once it passes the limit", async () => {
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1024));
      }
    });

    await expect(readCapped(endless, 4096)).resolves.toBeNull();
    expect(pulled).toBeLessThan(10);
  });

  it("reads a missing body as empty", async () => {
    await expect(readCapped(null)).resolves.toBe("");
  });
});
