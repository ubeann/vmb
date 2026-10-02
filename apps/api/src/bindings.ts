export type Bindings = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  WEB_URL: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  // Set (previews use `log`) to log outbound email instead of sending it; any
  // non-empty value suppresses, so a mis-set value can't leak real mail.
  // Production and local dev leave it unset and send via Resend (ADR-0019).
  EMAIL_TRANSPORT?: string;
  // Shared with apps/web, which sends it with the browser's address so that
  // address can be trusted as the client IP (ADR-0042). Optional on purpose:
  // while it is unset no forwarded address is trusted, and limits key on
  // `cf-connecting-ip` instead.
  CLIENT_IP_SECRET?: string;
};
