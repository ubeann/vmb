import { CLIENT_IP_HEADER, CLIENT_IP_SECRET_HEADER } from "@vmb/types";

// Better Auth reads the client IP from CLIENT_IP_HEADER alone (auth.ts), so
// every request handed to it, from the auth routes or the session guard, goes
// through here first: the one place that decides what that header holds
// (ADR-0042, #250). apps/web's value is kept only when the request also
// carries the shared secret; otherwise the header is replaced by
// `cf-connecting-ip`, which Cloudflare sets and a caller cannot. Either way
// the secret itself is dropped, so nothing downstream ever sees it.
//
// Without that check anyone could send CLIENT_IP_HEADER and choose their own
// rate-limit key. An unset secret trusts nothing.
//
// Returns a copy of the headers, not a Request: building a Request from one
// with a body takes that body over, which would leave nothing for a route
// behind the session guard to read.
export async function trustedClientIpHeaders(
  incoming: Headers,
  secret: string | undefined
): Promise<Headers> {
  const headers = new Headers(incoming);
  const forwarded = headers.get(CLIENT_IP_HEADER);
  const sentSecret = headers.get(CLIENT_IP_SECRET_HEADER);
  headers.delete(CLIENT_IP_SECRET_HEADER);

  const trusted =
    forwarded && secret && sentSecret !== null && (await secretsMatch(sentSecret, secret));
  const clientIp = trusted ? forwarded : headers.get("cf-connecting-ip");

  if (clientIp) headers.set(CLIENT_IP_HEADER, clientIp);
  else headers.delete(CLIENT_IP_HEADER);

  return headers;
}

// Compares digests rather than the strings, so the time taken says nothing
// about how much of a guess was right, or how long the secret is.
async function secretsMatch(sent: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(sent), digest(expected)]);
  return a.reduce((difference, byte, i) => difference | (byte ^ (b[i] ?? 0)), 0) === 0;
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
