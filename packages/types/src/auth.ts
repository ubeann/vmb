import { z } from "zod";

// The rules for the auth forms (issue #231). The pages check them in the browser
// before anything is sent, and `createAuthAction` checks them again on the
// server, so a form reads the same with or without JavaScript (ADR-0007).
//
// Messages tell the user what to do, not what went wrong, and carry no
// trailing period, the way a form label would.

export const EMAIL_REQUIRED_MESSAGE = "Enter your email";
export const EMAIL_INVALID_MESSAGE = "Enter a valid email, like name@company.com";

// Better Auth's own bounds for a password (its `minPasswordLength` and
// `maxPasswordLength` defaults, which `apps/api/src/auth.ts` does not override).
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

// The length of the code Better Auth's email OTP plugin sends by default.
export const OTP_LENGTH = 6;

const emailSchema = z
  .string()
  .trim()
  .min(1, EMAIL_REQUIRED_MESSAGE)
  .pipe(z.email(EMAIL_INVALID_MESSAGE));

// The password the user already has: any value they type is theirs to try, so
// only an empty field is caught before the server compares it.
const loginPasswordSchema = z.string().min(1, "Enter your password");

const otpSchema = z
  .string()
  .trim()
  .min(1, "Enter the code from your email")
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code from your email`);

const newPasswordSchema = z
  .string()
  .min(1, "Enter a new password")
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use ${PASSWORD_MAX_LENGTH} characters or fewer`);

export const LoginInputSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema
});

// Also what "Send a new code" submits.
export const ActivateRequestInputSchema = z.object({
  email: emailSchema
});

export const ActivateResetInputSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  password: newPasswordSchema
});
