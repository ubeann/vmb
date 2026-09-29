import type { z } from "zod";

type Shape = Record<string, z.ZodType<string>>;
export type FieldErrors<Schema extends z.ZodObject<Shape>> = Partial<
  Record<keyof Schema["shape"] & string, string>
>;

// In-page checks for an auth form, in place of the browser's own validation
// bubbles (issue #231). The form carries `novalidate`; this runs the same
// schema `createAuthAction` runs on the server, so both say the same thing.
//
// `serverErrors` are the field errors the server sent back. They and the
// browser's own errors share one `errors` value: a new server response replaces
// what the browser last found, and an edit clears (or updates) one field at a
// time whichever side raised it.
export function createFieldValidation<Schema extends z.ZodObject<Shape>>(
  schema: Schema,
  serverErrors: () => FieldErrors<Schema> | undefined
) {
  type Field = keyof Schema["shape"] & string;

  // `undefined` until the form has been checked or the server has replied with
  // errors, so a page can tell "no field errors yet" from "all fixed".
  let errors: FieldErrors<Schema> | undefined = $derived(serverErrors());

  function firstMessage(error: z.ZodError, field: Field) {
    return error.issues.find((issue) => issue.path[0] === field)?.message;
  }

  // Checks every field of the form. When something is wrong, shows it and moves
  // focus to the first invalid field, and returns false so the page can stop the
  // submit before it reaches the API.
  function validate(form: HTMLFormElement): boolean {
    const data = new FormData(form);
    const values: Record<string, string> = {};
    for (const field of Object.keys(schema.shape)) {
      const value = data.get(field);
      values[field] = typeof value === "string" ? value : "";
    }

    const result = schema.safeParse(values);
    if (result.success) {
      // Back to "nothing raised", so whatever the server replies with is shown
      // as it is: `errors` only re-reads `serverErrors` when that changes.
      errors = undefined;
      return true;
    }

    const next: FieldErrors<Schema> = {};
    for (const field of Object.keys(schema.shape) as Field[]) {
      const message = firstMessage(result.error, field);
      if (message) next[field] = message;
    }
    errors = next;

    // `elements` is in document order, so this is the first invalid field as
    // the user reads the form.
    for (const element of form.elements) {
      if (element instanceof HTMLInputElement && next[element.name as Field]) {
        element.focus();
        break;
      }
    }
    return false;
  }

  // For a field already marked invalid, checks it again as the user types, so
  // the message goes away the moment it stops being true. A field that is not
  // marked is left alone until the next submit.
  function oninput(event: Event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const field = input.name as Field;
    const rule = schema.shape[field];
    if (!errors?.[field] || !rule) return;

    const result = rule.safeParse(input.value);
    const next = { ...errors };
    if (result.success) delete next[field];
    else next[field] = result.error.issues[0]?.message;
    errors = next;
  }

  return {
    get errors() {
      return errors;
    },
    validate,
    oninput
  };
}
