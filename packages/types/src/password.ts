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

// Words a password about this account should not be built from: the name in the
// user's own email, and the product. NIST SP 800-63B allows a blocklist of
// context-specific words, and these are the first things a guess tries
// (ADR-0041). Not a composition rule: it refuses nothing about the shape.
export const PASSWORD_CONTEXT_CODE = "PASSWORD_CONTAINS_CONTEXT";
export const PASSWORD_CONTEXT_MESSAGE = 'Leave your email name and "VMB" out of your password.';

const PRODUCT_WORDS = ["vmb", "vmblogistics"];
// A shorter name would match by chance inside a long passphrase.
const MIN_EMAIL_NAME_LENGTH = 4;

/**
 * The context words the password is built from, as the user typed them in the
 * email, so a form can name them. Empty when it is clear of them.
 */
export function passwordContextWords(password: string, email: string): string[] {
  const lowered = password.toLowerCase();
  const name = email.split("@")[0]?.trim() ?? "";
  const words = name.length >= MIN_EMAIL_NAME_LENGTH ? [...PRODUCT_WORDS, name] : PRODUCT_WORDS;
  const found = words.filter((word) => lowered.includes(word.toLowerCase()));
  // "vmblogistics" already holds "vmb": naming both says the same thing twice.
  return found.some((word) => word.toLowerCase() === "vmblogistics")
    ? found.filter((word) => word.toLowerCase() !== "vmb")
    : found;
}

export function passwordContainsContext(password: string, email: string): boolean {
  return passwordContextWords(password, email).length > 0;
}
