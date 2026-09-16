import type { AuthApiClient, AuthSession, AuthUser } from "./auth.js";

export type SessionResult = { session: AuthSession | null; user: AuthUser | null };

const empty: SessionResult = { session: null, user: null };

export async function loadSession(client: AuthApiClient, cookie: string | null): Promise<SessionResult> {
  try {
    const { data } = await client.getSession({
      fetchOptions: cookie ? { headers: { cookie } } : undefined
    });

    return data ? { session: data.session, user: data.user } : empty;
  } catch (err) {
    console.error("loadSession: request to API failed", err);
    return empty;
  }
}
