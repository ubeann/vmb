import { z } from "zod";

// The one rule for a password someone is setting, shared by `/activate` and the
// Master CRUD user form (ADR-0041): 12 to 128 characters, no composition rules.
// `apps/api/src/auth.ts` sets Better Auth's own bounds from these, so the
// server enforces them for the endpoints it owns.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

// Not a length rule, so not part of `passwordSchema`: the API finds this out
// from Pwned Passwords after the length is accepted. Better Auth carries the
// code on its error body; the Master API carries the message.
export const PASSWORD_BREACHED_CODE = "PASSWORD_BREACHED";
export const PASSWORD_BREACHED_MESSAGE =
  "This password appeared in a data leak. Choose a different one.";

export const passwordSchema = z
  .string()
  .min(1, "Enter a new password")
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use ${PASSWORD_MAX_LENGTH} characters or fewer`);
