import type { AuthApiClient, AuthSession, AuthUser } from "./auth.js";

export type SessionResult = { session: AuthSession | null; user: AuthUser | null };

const empty: SessionResult = { session: null, user: null };

// No try/catch: a transport failure propagates to the API access seam
// (issue #82), which is the one place that owns it.
export async function loadSession(
  client: AuthApiClient,
  cookie: string | null
): Promise<SessionResult> {
  const { data } = await client.getSession({
    fetchOptions: cookie ? { headers: { cookie } } : undefined
  });

  return data ? { session: data.session, user: data.user } : empty;
}
