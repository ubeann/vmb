import { describe, expect, it } from "vitest";
import { fakeCookies } from "../test-support.js";
import { clearCheckedCode, keepCheckedCode, readCheckedCode } from "./checked-code.js";

const checked = { email: "a@example.com", otp: "123456" };
const onSite = new URL("https://vmb.example/activate");

describe("the checked code between Verify and Set password (#254)", () => {
  it("keeps a checked code and its email for the password step to read", () => {
    const cookies = fakeCookies();

    keepCheckedCode({ cookies, url: onSite }, checked);

    expect(readCheckedCode(cookies)).toEqual(checked);
  });

  it("keeps it where only /activate's server can read it, for at most 5 minutes", () => {
    const cookies = fakeCookies();

    keepCheckedCode({ cookies, url: onSite }, checked);

    expect(cookies.options("vmb_activate")).toEqual({
      path: "/activate",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      maxAge: 300
    });
  });

  // SvelteKit's own rule for its default: a dev server on plain-http
  // localhost could not store a Secure cookie in every browser.
  it("drops Secure only on plain-http localhost", () => {
    const cookies = fakeCookies();

    keepCheckedCode({ cookies, url: new URL("http://localhost:5173/activate") }, checked);

    expect(cookies.options("vmb_activate")).toMatchObject({ secure: false });
  });

  it("reads nothing when there is no cookie", () => {
    expect(readCheckedCode(fakeCookies())).toBeUndefined();
  });

  it.each([
    ["not JSON", "{"],
    ["no code", JSON.stringify({ email: "a@example.com" })],
    ["a malformed code", JSON.stringify({ email: "a@example.com", otp: "12" })],
    ["a malformed email", JSON.stringify({ email: "a@", otp: "123456" })]
  ])("reads nothing from a cookie with %s", (_case, value) => {
    expect(readCheckedCode(fakeCookies({ vmb_activate: value }))).toBeUndefined();
  });

  it("clears it from the same path it was set on", () => {
    const cookies = fakeCookies();
    keepCheckedCode({ cookies, url: onSite }, checked);

    clearCheckedCode(cookies);

    expect(readCheckedCode(cookies)).toBeUndefined();
    expect(cookies.options("vmb_activate")).toEqual({ path: "/activate" });
  });
});
