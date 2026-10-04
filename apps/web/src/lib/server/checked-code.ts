import type { Cookies } from "@sveltejs/kit";
import { ActivateVerifyInputSchema } from "@vmb/types";
import type { z } from "zod";

// A code Verify has checked waits here for the password step, with the email
// it was sent to (#254). Only /activate's server reads it: httpOnly, so no
// script can, and never put in the page, so it is not in the HTML. Holding it
// lets the page pick its step on a reload, and keeps the password step out of
// reach until a code has been checked. Better Auth still checks the code again
// when the password is set, so a cookie edited by hand gets no further.
const COOKIE = "vmb_activate";
const PATH = "/activate";
// The code itself lasts 5 minutes from when it was sent, so this never
// outlives it by more than the time it took to type.
const MAX_AGE_SECONDS = 5 * 60;

export type CheckedCode = z.output<typeof ActivateVerifyInputSchema>;

export function keepCheckedCode(
  { cookies, url }: { cookies: Pick<Cookies, "set">; url: URL },
  checked: CheckedCode
) {
  cookies.set(COOKIE, JSON.stringify(checked), {
    path: PATH,
    httpOnly: true,
    sameSite: "strict",
    // SvelteKit's own rule: a dev server on plain-http localhost may not be
    // able to store a Secure cookie. Everywhere else it is Secure.
    secure: !(url.hostname === "localhost" && url.protocol === "http:"),
    maxAge: MAX_AGE_SECONDS
  });
}

// Anything but a well-formed email and code reads as no checked code.
export function readCheckedCode(cookies: Pick<Cookies, "get">): CheckedCode | undefined {
  const value = cookies.get(COOKIE);
  if (!value) return undefined;
  try {
    const parsed = ActivateVerifyInputSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function clearCheckedCode(cookies: Pick<Cookies, "delete">) {
  cookies.delete(COOKIE, { path: PATH });
}
