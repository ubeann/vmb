import { describe, expect, it } from "vitest";
import { fakeCookies } from "../test-support.js";
import { clearSentCode, keepSentCode, readSentCode } from "./sent-code.js";

const onSite = new URL("https://vmb.example/activate");
const sentAt = Date.UTC(2026, 9, 4, 9, 0, 0);
const seconds = (n: number) => n * 1000;

describe("the send time kept for the resend countdown (#255)", () => {
  it("keeps the email and reads back a full minute to wait right after the send", () => {
    const cookies = fakeCookies();

    keepSentCode({ cookies, url: onSite }, "a@example.com", sentAt);

    expect(readSentCode(cookies, sentAt)).toEqual({ email: "a@example.com", resendIn: 60, sentAt });
  });

  it("counts the wait down from the send time, rounding up to whole seconds", () => {
    const cookies = fakeCookies();
    keepSentCode({ cookies, url: onSite }, "a@example.com", sentAt);

    expect(readSentCode(cookies, sentAt + seconds(18))?.resendIn).toBe(42);
    expect(readSentCode(cookies, sentAt + seconds(18) + 400)?.resendIn).toBe(42);
    expect(readSentCode(cookies, sentAt + seconds(59) + 1)?.resendIn).toBe(1);
  });

  it("has nothing left to wait for once the minute is up, while the code is still good", () => {
    const cookies = fakeCookies();
    keepSentCode({ cookies, url: onSite }, "a@example.com", sentAt);

    expect(readSentCode(cookies, sentAt + seconds(60))?.resendIn).toBe(0);
    expect(readSentCode(cookies, sentAt + seconds(4 * 60))?.resendIn).toBe(0);
  });

  it("reads nothing once the code itself has expired", () => {
    const cookies = fakeCookies();
    keepSentCode({ cookies, url: onSite }, "a@example.com", sentAt);

    expect(readSentCode(cookies, sentAt + seconds(5 * 60) + 1)).toBeUndefined();
  });

  // A clock set back, or a cookie edited by hand, can't stretch the wait.
  it("never reads more than a minute to wait", () => {
    const cookies = fakeCookies();
    keepSentCode({ cookies, url: onSite }, "a@example.com", sentAt + seconds(3600));

    expect(readSentCode(cookies, sentAt)?.resendIn).toBe(60);
  });

  it("keeps it where only /activate's server can read it, for as long as the code lasts", () => {
    const cookies = fakeCookies();

    keepSentCode({ cookies, url: onSite }, "a@example.com", sentAt);

    expect(cookies.options("vmb_activate_sent")).toEqual({
      path: "/activate",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      maxAge: 300
    });
  });

  it("drops Secure only on plain-http localhost", () => {
    const cookies = fakeCookies();

    keepSentCode(
      { cookies, url: new URL("http://localhost:5173/activate") },
      "a@example.com",
      sentAt
    );

    expect(cookies.options("vmb_activate_sent")).toMatchObject({ secure: false });
  });

  it("reads nothing when there is no cookie", () => {
    expect(readSentCode(fakeCookies(), sentAt)).toBeUndefined();
  });

  it.each([
    ["not JSON", "{"],
    ["no send time", JSON.stringify({ email: "a@example.com" })],
    ["a send time that is not a number", JSON.stringify({ email: "a@example.com", sentAt: "now" })],
    ["no email", JSON.stringify({ sentAt })],
    ["a malformed email", JSON.stringify({ email: "a@", sentAt })]
  ])("reads nothing from a cookie with %s", (_case, value) => {
    expect(readSentCode(fakeCookies({ vmb_activate_sent: value }), sentAt)).toBeUndefined();
  });

  it("clears it from the same path it was set on", () => {
    const cookies = fakeCookies();
    keepSentCode({ cookies, url: onSite }, "a@example.com", sentAt);

    clearSentCode(cookies);

    expect(readSentCode(cookies, sentAt)).toBeUndefined();
    expect(cookies.options("vmb_activate_sent")).toEqual({ path: "/activate" });
  });
});
