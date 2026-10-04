// Pwned Passwords check (ADR-0041). The range API takes the first 5 hex
// characters of the password's SHA-1 and answers with every known suffix under
// that prefix, so the password never leaves the Worker, nor does its full hash.
//
// This fails open: a password is only refused when the API says it is
// breached. Better Auth's own `haveibeenpwned` plugin fails closed and skips
// the Master CRUD, which is why this is not that.
const RANGE_URL = "https://api.pwnedpasswords.com/range/";
// Past this the user is waiting on a third party, so the check gives up.
const TIMEOUT_MS = 3000;

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** What the routes depend on, so a test can swap the real lookup out. */
export type PasswordBreachCheck = (password: string) => Promise<boolean>;

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export async function isPasswordBreached(
  password: string,
  fetchRange: Fetch = fetch
): Promise<boolean> {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetchRange(`${RANGE_URL}${prefix}`, {
      // Padded replies hide how many real matches a prefix has, so their size
      // says nothing. The padding rows carry a count of 0 and are skipped below.
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response.ok) {
      console.error("breached password check: Pwned Passwords answered", response.status);
      return false;
    }

    for (const line of (await response.text()).split("\n")) {
      const [listed, count] = line.trim().split(":");
      if (listed === suffix) return Number(count) > 0;
    }
    return false;
  } catch (error) {
    console.error("breached password check: request failed", error);
    return false;
  }
}
