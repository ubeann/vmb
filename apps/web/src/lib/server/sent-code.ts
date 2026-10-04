import type { Cookies } from "@sveltejs/kit";
import { ActivateRequestInputSchema } from "@vmb/types";
import { z } from "zod";

// When /activate last sent a code, and to which email, so a reload keeps the
// code step and the time left before "Send a new code" is back (#255). Same
// handling as the checked code (`./checked-code.js`): httpOnly, scoped to
// /activate, never in the page. It holds nothing secret, and it is set for any
// email that gets a reply, so it tells a registered email from an unregistered
// one no more than the reply does (#232). The countdown is a hint: the server's
// rate limits are the gate (ADR-0042).
const COOKIE = "vmb_activate_sent";
const PATH = "/activate";
// The code lasts 5 minutes from when it was sent; past that there is no code
// step to come back to.
const CODE_LIFETIME_SECONDS = 5 * 60;
const RESEND_WAIT_SECONDS = 60;

const SentCodeSchema = ActivateRequestInputSchema.extend({ sentAt: z.number().finite() });

export function keepSentCode(
  { cookies, url }: { cookies: Pick<Cookies, "set">; url: URL },
  email: string,
  now = Date.now()
) {
  cookies.set(COOKIE, JSON.stringify({ email, sentAt: now }), {
    path: PATH,
    httpOnly: true,
    sameSite: "strict",
    // SvelteKit's own rule: a dev server on plain-http localhost may not be
    // able to store a Secure cookie. Everywhere else it is Secure.
    secure: !(url.hostname === "localhost" && url.protocol === "http:"),
    maxAge: CODE_LIFETIME_SECONDS
  });
}

// The email, the whole seconds left to wait (0 once the minute is up), and the
// send time itself, which changes with every code sent. Anything but a
// well-formed, unexpired record reads as no code sent. The wait is capped at a
// minute, so a clock set back or a hand-edited cookie can't stretch it.
export function readSentCode(
  cookies: Pick<Cookies, "get">,
  now = Date.now()
): { email: string; resendIn: number; sentAt: number } | undefined {
  const value = cookies.get(COOKIE);
  if (!value) return undefined;
  try {
    const parsed = SentCodeSchema.safeParse(JSON.parse(value));
    if (!parsed.success) return undefined;
    const { email, sentAt } = parsed.data;
    const elapsed = (now - sentAt) / 1000;
    if (elapsed > CODE_LIFETIME_SECONDS) return undefined;
    const resendIn = Math.ceil(RESEND_WAIT_SECONDS - elapsed);
    return { email, resendIn: Math.min(RESEND_WAIT_SECONDS, Math.max(0, resendIn)), sentAt };
  } catch {
    return undefined;
  }
}

export function clearSentCode(cookies: Pick<Cookies, "delete">) {
  cookies.delete(COOKIE, { path: PATH });
}
