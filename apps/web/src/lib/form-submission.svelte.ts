import type { ActionResult } from "$app/forms";
import { focusFirstInvalidField } from "$lib/field-validation.svelte.js";

type Outcome = { result: ActionResult; update: () => Promise<void> };
type Validation = { validate: (form: HTMLFormElement) => boolean };

/**
 * What a page does once an action has replied: bring the page up to date with
 * `update`, then whatever else the reply calls for. `createSubmission` flags
 * the form as submitting around it.
 */
export type Handle = (input: {
  formElement: HTMLFormElement;
}) => (outcome: Outcome) => Promise<void>;

// The usual reply: update the page, and when the server turned the form down,
// put focus on the field it marked.
const focusAfterFailure: Handle =
  ({ formElement }) =>
  async ({ result, update }) => {
    await update();
    if (result.type === "failure") focusFirstInvalidField(formElement);
  };

/** How long a send may take before the page says it is still working. */
export const SLOW_AFTER_MS = 8000;

/**
 * The `use:enhance` callback the auth forms share (issues #209, #231): stop a
 * form whose fields fail `validation` before anything is sent, and report
 * `submitting` from the send until the page is up to date, so the button can
 * show progress. Give `handle` to take over what happens on the reply.
 *
 * One send at a time per page: a second one while the first is under way is
 * turned away, so a button can show its progress at full colour and keep focus
 * instead of being disabled. `pending` names the form being sent, for a page
 * with more than one: list the names as `Name` and give each form its `name`,
 * so a misspelt one is a type error. `slow` turns true once a send has taken
 * `SLOW_AFTER_MS`.
 */
export function createSubmission<Name extends string = "form">() {
  let pending = $state<Name | undefined>();
  let slow = $state(false);

  return {
    get submitting() {
      return pending !== undefined;
    },
    get pending() {
      return pending;
    },
    get slow() {
      return slow;
    },
    enhance(validation?: Validation, handle: Handle = focusAfterFailure, name = "form" as Name) {
      return (input: { formElement: HTMLFormElement; cancel: () => void }) => {
        if (pending !== undefined) return input.cancel();
        if (validation && !validation.validate(input.formElement)) return input.cancel();
        pending = name;
        const timer = setTimeout(() => (slow = true), SLOW_AFTER_MS);
        const settle = handle(input);
        return async (outcome: Outcome) => {
          try {
            await settle(outcome);
          } finally {
            clearTimeout(timer);
            slow = false;
            pending = undefined;
          }
        };
      };
    }
  };
}
