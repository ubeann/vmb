// The browser never calls apps/api's auth endpoints itself: apps/web calls them
// server-side, so apps/api would otherwise key its rate limits on apps/web's
// address. apps/web forwards the browser's address in CLIENT_IP_HEADER and
// proves the header is its own with the shared CLIENT_IP_SECRET in
// CLIENT_IP_SECRET_HEADER. apps/api trusts the address only when the secret
// matches (ADR-0042).
export const CLIENT_IP_HEADER = "x-vmb-client-ip";
export const CLIENT_IP_SECRET_HEADER = "x-vmb-client-ip-secret";
