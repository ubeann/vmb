import type { ActionResult } from "$app/forms";
import { describe, expect, it, vi } from "vitest";
import { SLOW_AFTER_MS, createSubmission } from "./form-submission.svelte.js";

function formWithField() {
  const form = document.createElement("form");
  const input = document.createElement("input");
  input.name = "email";
  form.append(input);
  document.body.append(form);
  return { form, input };
}

// What SvelteKit's `enhance` does around the page's callback: it calls the
// callback on submit, and calls what it returns once the action has replied.
function submit(
  enhance: ReturnType<ReturnType<typeof createSubmission>["enhance"]>,
  formElement: HTMLFormElement
) {
  const cancel = vi.fn();
  const complete = (enhance as unknown as (input: object) => unknown)({ formElement, cancel });
  return {
    cancel,
    reply: (type: "success" | "failure", update: () => Promise<void> = async () => {}) => {
      const result: ActionResult = {
        type,
        status: type === "success" ? 200 : 400,
        location: formElement.action
      };
      return (complete as (outcome: object) => Promise<void>)({ result, update });
    }
  };
}

describe("createSubmission", () => {
  it("stops a form that fails validation before anything is sent", () => {
    const { form } = formWithField();
    const submission = createSubmission();
    const validation = { validate: vi.fn(() => false) };

    const { cancel } = submit(submission.enhance(validation), form);

    expect(validation.validate).toHaveBeenCalledWith(form);
    expect(cancel).toHaveBeenCalledOnce();
    expect(submission.submitting).toBe(false);
  });

  it("reports progress from the send until the page is up to date", async () => {
    const { form } = formWithField();
    const submission = createSubmission();
    let finish!: () => void;
    const update = () => new Promise<void>((resolve) => (finish = resolve));

    const { cancel, reply } = submit(submission.enhance({ validate: () => true }), form);
    expect(cancel).not.toHaveBeenCalled();
    expect(submission.submitting).toBe(true);

    const replied = reply("success", update);
    expect(submission.submitting).toBe(true);
    finish();
    await replied;

    expect(submission.submitting).toBe(false);
  });

  it("sends a form with no validation of its own", () => {
    const { form } = formWithField();
    const submission = createSubmission();

    const { cancel } = submit(submission.enhance(), form);

    expect(cancel).not.toHaveBeenCalled();
    expect(submission.submitting).toBe(true);
  });

  it("puts focus on the first invalid field after the server turns the form down", async () => {
    const { form, input } = formWithField();
    const submission = createSubmission();

    const { reply } = submit(submission.enhance(), form);
    await reply("failure", async () => input.setAttribute("aria-invalid", "true"));

    expect(document.activeElement).toBe(input);
  });

  it("leaves focus alone after a success", async () => {
    const { form, input } = formWithField();
    input.setAttribute("aria-invalid", "true");
    const submission = createSubmission();

    const { reply } = submit(submission.enhance(), form);
    await reply("success");

    expect(document.activeElement).not.toBe(input);
  });

  it("lets the page handle the reply itself, and still tracks progress", async () => {
    const { form } = formWithField();
    const submission = createSubmission();
    const handled: string[] = [];
    const handle =
      () =>
      async ({ result }: { result: ActionResult }) => {
        handled.push(result.type);
        expect(submission.submitting).toBe(true);
      };

    const { reply } = submit(submission.enhance(undefined, handle), form);
    await reply("success");

    expect(handled).toEqual(["success"]);
    expect(submission.submitting).toBe(false);
  });

  it("brings the button back when updating the page throws", async () => {
    const { form } = formWithField();
    const submission = createSubmission();

    const { reply } = submit(submission.enhance(), form);
    await expect(reply("success", () => Promise.reject(new Error("offline")))).rejects.toThrow(
      "offline"
    );

    expect(submission.submitting).toBe(false);
  });

  it("turns away a second send while one is under way", async () => {
    const { form } = formWithField();
    const other = formWithField().form;
    const submission = createSubmission();

    const first = submit(submission.enhance(), form);
    const second = submit(submission.enhance(), other);

    expect(first.cancel).not.toHaveBeenCalled();
    expect(second.cancel).toHaveBeenCalledOnce();
    await first.reply("success");
    expect(submit(submission.enhance(), other).cancel).not.toHaveBeenCalled();
  });

  it("names the form that is being sent", async () => {
    const { form } = formWithField();
    const submission = createSubmission<"resend">();

    const { reply } = submit(submission.enhance(undefined, undefined, "resend"), form);
    expect(submission.pending).toBe("resend");

    await reply("success");
    expect(submission.pending).toBeUndefined();
  });

  it("says the send is slow once it has taken a while, until it settles", async () => {
    vi.useFakeTimers();
    try {
      const { form } = formWithField();
      const submission = createSubmission();

      const { reply } = submit(submission.enhance(), form);
      vi.advanceTimersByTime(SLOW_AFTER_MS - 1);
      expect(submission.slow).toBe(false);
      vi.advanceTimersByTime(1);
      expect(submission.slow).toBe(true);

      await reply("success");
      expect(submission.slow).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
