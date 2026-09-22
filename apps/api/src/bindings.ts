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
};
