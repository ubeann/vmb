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
 * A native form sends `"on"` when checked and nothing at all when unchecked,
 * which `z.boolean().default(false)` would already read as false — so a form
 * renders no hidden companion input. (A duplicate name would be a bug:
 * Superforms parses the last `FormData` entry, so a hidden `"false"` after the
 * checkbox silently deactivates every submit.) Plain `z.coerce.boolean()` is
 * unusable either way: it reads the string `"false"` as `true`.
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

/**
 * The `updatedAt` a client last read for a record, sent back with its edit so
 * the save can be refused when someone changed the record since (a
 * `STALE_RECORD` conflict). It is the exact string the API served, to the
 * millisecond the columns keep. A record that was never stamped, as a legacy
 * import may leave one, reads `null`, and an edit form posts that as an empty
 * field. Required on every update, so an old client cannot skip the check.
 */
export const updatedAtSchema = z.iso.datetime().nullable();
