import { z } from "zod";
import { passwordSchema } from "./password.js";

// The rules for the auth forms (issue #231). The pages check them in the browser
// before anything is sent, and `createAuthAction` checks them again on the
// server, so a form reads the same with or without JavaScript (ADR-0007).
//
// Messages tell the user what to do, not what went wrong, and carry no
// trailing period, the way a form label would.

export const EMAIL_REQUIRED_MESSAGE = "Enter your email";
export const EMAIL_INVALID_MESSAGE = "Enter a valid email, like name@example.com";

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

export const LoginInputSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema
});

// Also what "Send a new code" submits.
export const ActivateRequestInputSchema = z.object({
  email: emailSchema
});

// The code step's Verify: the code is checked against the email it was sent to.
export const ActivateVerifyInputSchema = z.object({
  email: emailSchema,
  otp: otpSchema
});

// The password step. The email and the checked code wait on the server, so
// only the new password is posted (#254).
export const ActivatePasswordInputSchema = z.object({
  password: passwordSchema
});
