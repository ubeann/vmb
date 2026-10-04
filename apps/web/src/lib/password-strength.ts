import { PASSWORD_MIN_LENGTH } from "@vmb/types";

// The reading under the new-password field (ADR-0041). It is advice, never a
// rule: the length rule is what blocks. It reads length alone, which NIST SP
// 800-63B says matters most, so it cannot call "Password1!" strong the way a
// meter that counts uppercase, digits and symbols does.
export type PasswordStrength = "okay" | "good" | "strong";

const PASSWORD_STRENGTH_LABELS: Record<PasswordStrength, string> = {
  okay: "Okay",
  good: "Good",
  strong: "Strong"
};

const GOOD_AT = 16;
/** The length at which the bar is full. */
export const PASSWORD_BAR_FULL_AT = 20;

/** `undefined` while the password is still shorter than the minimum. */
export function passwordStrength(length: number): PasswordStrength | undefined {
  if (length < PASSWORD_MIN_LENGTH) return undefined;
  if (length >= PASSWORD_BAR_FULL_AT) return "strong";
  return length >= GOOD_AT ? "good" : "okay";
}

/** How full the bar is, 0 to 1. */
export function passwordBarFill(length: number): number {
  return Math.min(length, PASSWORD_BAR_FULL_AT) / PASSWORD_BAR_FULL_AT;
}

/** Where the minimum sits on the bar, 0 to 1. */
export const PASSWORD_MIN_MARK = PASSWORD_MIN_LENGTH / PASSWORD_BAR_FULL_AT;

/** What the bar says: the minimum, how far from it, then the reading. */
export function passwordReading(length: number): string {
  const strength = passwordStrength(length);
  if (strength) return `Length: ${PASSWORD_STRENGTH_LABELS[strength]}`;
  const missing = PASSWORD_MIN_LENGTH - length;
  if (length === 0) return `At least ${PASSWORD_MIN_LENGTH} characters`;
  return missing === 1 ? "1 more character" : `${missing} more characters`;
}
