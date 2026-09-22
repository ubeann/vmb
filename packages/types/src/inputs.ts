import { z } from "zod";

/**
 * A text field the form may leave empty. The empty string is the form's way
 * of saying "no value"; each store maps it to `null` on the way to the
 * database, matching how the legacy tables held it.
 */
export function optionalText(max: number) {
  return z.string().trim().max(max).default("");
}

/**
 * A checkbox, from either a JSON request or an HTML form.
 *
 * A native form sends `"on"` when checked and nothing when unchecked, so a
 * form renders a hidden `value="false"` input after the checkbox; absent
 * entirely (a JSON body) means unchecked. Plain `z.coerce.boolean()` cannot be
 * used here: it reads the string `"false"` as `true`.
 */
export const checkboxSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value === "on" || value === "true" || value === "1" : value,
  z.boolean().default(false)
);

/**
 * The legacy form's phone handling (`UserResource.php:123-143`): strip every
 * non-digit, drop a leading trunk `0` or country `62`, and re-prefix `+62`.
 */
export const indonesianPhoneSchema = z
  .string()
  .trim()
  .max(20)
  .transform((value) => {
    const digits = value.replace(/\D/g, "").replace(/^0+/, "").replace(/^62/, "");
    return `+62${digits}`;
  })
  .pipe(
    z.string().regex(/^\+62\d{7,13}$/, "Phone must be an Indonesian number such as +6281234567890.")
  );
