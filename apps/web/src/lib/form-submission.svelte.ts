import type { ActionResult } from "@sveltejs/kit";
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

/**
 * The `use:enhance` callback the auth forms share (issues #209, #231): stop a
 * form whose fields fail `validation` before anything is sent, and report
 * `submitting` from the send until the page is up to date, so the button can
 * show progress. Give `handle` to take over what happens on the reply.
 */
export function createSubmission() {
  let submitting = $state(false);

  return {
    get submitting() {
      return submitting;
    },
    enhance(validation?: Validation, handle: Handle = focusAfterFailure) {
      return (input: { formElement: HTMLFormElement; cancel: () => void }) => {
        if (validation && !validation.validate(input.formElement)) return input.cancel();
        submitting = true;
        const settle = handle(input);
        return async (outcome: Outcome) => {
          try {
            await settle(outcome);
          } finally {
            submitting = false;
          }
        };
      };
    }
  };
}
