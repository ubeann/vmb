import { CLIENT_IP_HEADER, CLIENT_IP_SECRET_HEADER } from "@vmb/types";

// Better Auth reads the client IP from CLIENT_IP_HEADER alone (auth.ts), so
// this is the one place that decides what that header holds (ADR-0042, #250).
// apps/web's value is kept only when the request also carries the shared
// secret; otherwise the header is replaced by `cf-connecting-ip`, which
// Cloudflare sets and a caller cannot. Either way the secret itself is
// dropped, so nothing downstream ever sees it.
//
// Without that check anyone could send CLIENT_IP_HEADER and choose their own
// rate-limit key. An unset secret trusts nothing.
export async function withTrustedClientIp(
  request: Request,
  secret: string | undefined
): Promise<Request> {
  const headers = new Headers(request.headers);
  const forwarded = headers.get(CLIENT_IP_HEADER);
  const sentSecret = headers.get(CLIENT_IP_SECRET_HEADER);
  headers.delete(CLIENT_IP_SECRET_HEADER);

  const trusted =
    forwarded && secret && sentSecret !== null && (await secretsMatch(sentSecret, secret));
  const clientIp = trusted ? forwarded : headers.get("cf-connecting-ip");

  if (clientIp) headers.set(CLIENT_IP_HEADER, clientIp);
  else headers.delete(CLIENT_IP_HEADER);

  return new Request(request, { headers });
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
