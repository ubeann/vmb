import { afterEach, describe, expect, it, vi } from "vitest";
import { isPasswordBreached } from "./breached-password.js";

// SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PREFIX = "5BAA6";
const SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

function rangeReply(lines: string[], status = 200) {
  return new Response(lines.join("\r\n"), { status });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isPasswordBreached", () => {
  it("sends only the first 5 hex characters of the SHA-1, with padding asked for", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => rangeReply([]));

    await isPasswordBreached("password", fetchMock);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${PREFIX}`);
    expect(new Headers(init?.headers).get("Add-Padding")).toBe("true");
    expect(String(url)).not.toContain(SUFFIX);
  });

  it("is breached when the suffix is listed with a count", async () => {
    const fetchMock = async () =>
      rangeReply(["0018A45C4D1DEF81644B54AB7F969B88D65:3", `${SUFFIX}:10434004`]);

    await expect(isPasswordBreached("password", fetchMock)).resolves.toBe(true);
  });

  it("is not breached when the suffix is absent", async () => {
    const fetchMock = async () => rangeReply(["0018A45C4D1DEF81644B54AB7F969B88D65:3"]);

    await expect(isPasswordBreached("password", fetchMock)).resolves.toBe(false);
  });

  it("ignores the padding rows, which carry a count of 0", async () => {
    const fetchMock = async () => rangeReply([`${SUFFIX}:0`]);

    await expect(isPasswordBreached("password", fetchMock)).resolves.toBe(false);
  });

  it("fails open and logs when the API errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = async () => rangeReply([], 503);

    await expect(isPasswordBreached("password", fetchMock)).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("breached password check"), 503);
  });

  it("fails open and logs when the API cannot be reached", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new TypeError("fetch failed");
    const fetchMock = async () => {
      throw failure;
    };

    await expect(isPasswordBreached("password", fetchMock)).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("breached password check"), failure);
  });
});
