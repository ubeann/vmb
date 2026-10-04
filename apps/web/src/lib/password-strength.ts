import { PASSWORD_MIN_LENGTH } from "@vmb/types";

// An advice, never a rule (ADR-0041): how a password that already passes reads
// by length alone. Length is what NIST SP 800-63B says matters most, and a
// length-only reading cannot call "Password1!" strong the way a meter that
// counts uppercase, digits and symbols does.
export type PasswordStrength = "okay" | "good" | "strong";

export const PASSWORD_STRENGTH_LABELS: Record<PasswordStrength, string> = {
  okay: "Okay",
  good: "Good",
  strong: "Strong"
};

const GOOD_AT = 16;
const STRONG_AT = 20;

/** `undefined` while the password is still shorter than the minimum. */
export function passwordStrength(length: number): PasswordStrength | undefined {
  if (length < PASSWORD_MIN_LENGTH) return undefined;
  if (length >= STRONG_AT) return "strong";
  return length >= GOOD_AT ? "good" : "okay";
}
