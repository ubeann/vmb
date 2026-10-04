import { describe, expect, it } from "vitest";
import { mapAuthErrorToCopy } from "./auth-error-copy.js";

describe("mapAuthErrorToCopy", () => {
  it("maps a known code to its VMB copy", () => {
    expect(mapAuthErrorToCopy({ code: "OTP_EXPIRED" }, "fallback")).toBe(
      "This code expired. Send a new one."
    );
  });

  it("maps a breached password to its own copy", () => {
    expect(mapAuthErrorToCopy({ code: "PASSWORD_BREACHED" }, "fallback")).toBe(
      "This password appeared in a data leak. Choose a different one."
    );
  });

  it("maps a password built from the email or VMB to its own copy", () => {
    expect(mapAuthErrorToCopy({ code: "PASSWORD_CONTAINS_CONTEXT" }, "fallback")).toBe(
      'Leave your email name and "VMB" out of your password.'
    );
  });

  it("maps the sign-in gate's code to the same copy the API uses", () => {
    expect(mapAuthErrorToCopy({ code: "ACCOUNT_UNAVAILABLE" }, "fallback")).toBe(
      "This account is unavailable. Contact an administrator."
    );
  });

  it("treats a 429 status as rate limiting regardless of code", () => {
    expect(mapAuthErrorToCopy({ status: 429 }, "fallback")).toBe(
      "Too many attempts. Wait a moment and try again."
    );
    expect(mapAuthErrorToCopy({ status: 429, code: "SOME_OTHER_CODE" }, "fallback")).toBe(
      "Too many attempts. Wait a moment and try again."
    );
  });

  it("falls back to the route's copy for an unlisted code", () => {
    expect(mapAuthErrorToCopy({ code: "SOME_OTHER_CODE" }, "fallback")).toBe("fallback");
  });

  // Copy of its own would tell an unregistered email from a registered one:
  // the account-enumeration leak #205 and #232 keep closed.
  it("never gives USER_NOT_FOUND copy of its own", () => {
    expect(mapAuthErrorToCopy({ code: "USER_NOT_FOUND" }, "fallback")).toBe("fallback");
  });

  it("falls back to the route's copy when there is no code at all", () => {
    expect(mapAuthErrorToCopy({}, "fallback")).toBe("fallback");
  });
});
