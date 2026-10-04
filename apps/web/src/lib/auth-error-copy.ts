import { EMAIL_INVALID_MESSAGE } from "@vmb/types";

// Better Auth's `error.message` is written for developers and varies in tone
// across codes, so `createAuthAction` never shows it. This maps the stable
// `error.code` — never message text — to VMB copy. Rate limiting (429) has no
// `code` of its own (issue #205), so it is matched on `status` instead.
//
// A code with no entry here — including ones deliberately left out, such as
// `USER_NOT_FOUND` on the password-reset request step, where naming the cause
// would reveal whether an email has an account — falls through to the calling
// route's own fallback copy.
export interface AuthErrorLike {
  code?: string;
  status?: number;
}

const AUTH_ERROR_COPY: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Invalid email or password.",
  INVALID_EMAIL: EMAIL_INVALID_MESSAGE,
  EMAIL_NOT_VERIFIED: "Verify your email to sign in. Check your inbox for the verification link.",
  FAILED_TO_CREATE_SESSION: "Unable to sign you in right now. Try again in a moment.",
  ACCOUNT_UNAVAILABLE: "This account is unavailable. Contact an administrator.",
  OTP_EXPIRED: "This code expired. Send a new one.",
  INVALID_OTP: "That code isn't right. Enter it again.",
  TOO_MANY_ATTEMPTS: "Too many attempts. Send a new code and try again.",
  PASSWORD_TOO_SHORT: "Choose a longer password.",
  PASSWORD_TOO_LONG: "Choose a shorter password."
};

const RATE_LIMIT_MESSAGE = "Too many attempts. Wait a moment and try again.";

export function mapAuthErrorToCopy(error: AuthErrorLike, fallback: string): string {
  if (error.status === 429) return RATE_LIMIT_MESSAGE;
  const copy = error.code ? AUTH_ERROR_COPY[error.code] : undefined;
  return copy ?? fallback;
}
