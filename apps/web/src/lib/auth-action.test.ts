import { EMAIL_INVALID_MESSAGE, LoginInputSchema } from "@vmb/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthErrorLike } from "./auth-error-copy.js";

const withAuthApiClientMock = vi.fn();

vi.mock("./api-access.js", () => ({
  withAuthApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withAuthApiClientMock(event, run)
}));

const { createAuthAction } = await import("./auth-action.js");
const { fakeAuthEvent } = await import("./test-support.js");

const clientSentinel = { kind: "auth" };

type Run = (
  client: unknown,
  values: { email: string; password: string },
  event: unknown
) => Promise<{ error?: (AuthErrorLike & { message?: string }) | null }>;

function makeAction(
  run: Run = async () => ({ error: null }),
  onSuccess: () => unknown = () => ({ ok: true })
) {
  return createAuthAction({
    schema: LoginInputSchema,
    invalidFieldsMessage: "Enter your email and password",
    fallbackErrorMessage: "Invalid email or password.",
    logLabel: "login action",
    run: run as never,
    onSuccess: onSuccess as never
  });
}

beforeEach(() => {
  withAuthApiClientMock.mockReset();
  withAuthApiClientMock.mockImplementation(
    async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
      ok: true,
      value: await run(clientSentinel)
    })
  );
});

describe("createAuthAction", () => {
  it("fails with the route's message and never calls the API when a field is missing", async () => {
    const run = vi.fn<Run>();
    const action = makeAction(run);

    const result = await action(fakeAuthEvent({ email: "a@example.com" }));

    expect(result).toMatchObject({
      status: 400,
      data: {
        error: "Enter your email and password",
        fieldErrors: { password: "Enter your password" }
      }
    });
    expect(run).not.toHaveBeenCalled();
    expect(withAuthApiClientMock).not.toHaveBeenCalled();
  });

  it("treats an empty string as a missing field", async () => {
    const action = makeAction();

    const result = await action(fakeAuthEvent({ email: "", password: "secret" }));

    expect(result).toMatchObject({
      status: 400,
      data: {
        error: "Enter your email and password",
        fieldErrors: { email: "Enter your email" }
      }
    });
    expect(withAuthApiClientMock).not.toHaveBeenCalled();
  });

  it("names every invalid field at once, one message each", async () => {
    const action = makeAction();

    const result = await action(fakeAuthEvent({ email: "not-an-email" }));

    expect(result).toMatchObject({
      status: 400,
      data: { fieldErrors: { email: EMAIL_INVALID_MESSAGE, password: "Enter your password" } }
    });
  });

  it("rejects a malformed email before the API is called", async () => {
    const action = makeAction();

    const result = await action(fakeAuthEvent({ email: "name@", password: "secret" }));

    expect(result).toMatchObject({
      status: 400,
      data: { fieldErrors: { email: EMAIL_INVALID_MESSAGE } }
    });
    expect(withAuthApiClientMock).not.toHaveBeenCalled();
  });

  it("hands the API the parsed values, so a padded email is trimmed", async () => {
    const run = vi.fn<Run>(async () => ({ error: null }));
    const action = makeAction(run);

    await action(fakeAuthEvent({ email: " a@example.com ", password: "secret" }));

    expect(run).toHaveBeenCalledWith(
      clientSentinel,
      { email: "a@example.com", password: "secret" },
      expect.anything()
    );
  });

  it("turns Better Auth's INVALID_EMAIL into an email field error, not a banner-only failure", async () => {
    const action = makeAction(async () => ({
      error: { code: "INVALID_EMAIL", message: "Invalid email" }
    }));

    const result = await action(fakeAuthEvent({ email: "a@example.com", password: "secret" }));

    expect(result).toMatchObject({
      status: 400,
      data: { fieldErrors: { email: EMAIL_INVALID_MESSAGE } }
    });
  });

  it("maps a transport failure to the shared 500 message and logs it", async () => {
    const error = new Error("network down");
    withAuthApiClientMock.mockResolvedValueOnce({ ok: false, error });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const action = makeAction();

    const result = await action(fakeAuthEvent({ email: "a@example.com", password: "secret" }));

    expect(result).toMatchObject({
      status: 500,
      data: { error: "Unable to reach the server. Check your connection and try again." }
    });
    expect(consoleError).toHaveBeenCalledWith("login action: request to API failed", error);
    consoleError.mockRestore();
  });

  it("maps a known Better Auth error code to VMB copy, never the raw message", async () => {
    const action = makeAction(async () => ({
      error: { code: "EMAIL_NOT_VERIFIED", message: "email not verified" }
    }));

    const result = await action(fakeAuthEvent({ email: "a@example.com", password: "nope" }));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "Verify your email to sign in. Check your inbox for the verification link." }
    });
  });

  it("treats a 429 status as rate limiting even though it carries no code", async () => {
    const action = makeAction(async () => ({ error: { status: 429 } }));

    const result = await action(fakeAuthEvent({ email: "a@example.com", password: "nope" }));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "Too many attempts. Wait a moment and try again." }
    });
  });

  it("falls back to the route's error when Better Auth reports no known code", async () => {
    const action = makeAction(async () => ({ error: {} }));

    const result = await action(fakeAuthEvent({ email: "a@example.com", password: "nope" }));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "Invalid email or password." }
    });
  });

  it("passes the built client, validated values, and the event to the route's call", async () => {
    const run = vi.fn<Run>(async () => ({ error: null }));
    const action = makeAction(run);
    const event = fakeAuthEvent({ email: "a@example.com", password: "secret" });

    await action(event);

    expect(run).toHaveBeenCalledWith(
      clientSentinel,
      { email: "a@example.com", password: "secret" },
      event
    );
  });

  it("returns onSuccess's value on a clean call", async () => {
    const action = makeAction(undefined, () => ({ success: true }));

    await expect(
      action(fakeAuthEvent({ email: "a@example.com", password: "secret" }))
    ).resolves.toEqual({ success: true });
  });

  it("passes the validated values to onSuccess, so a route can carry them forward", async () => {
    const onSuccess = vi.fn((_values: unknown) => ({ ok: true }));
    const action = makeAction(undefined, onSuccess as never);

    await action(fakeAuthEvent({ email: "a@example.com", password: "secret" }));

    expect(onSuccess).toHaveBeenCalledWith({ email: "a@example.com", password: "secret" });
  });

  describe("with a checkbox field", () => {
    function makeRememberAction(run: (client: unknown, values: unknown) => Promise<unknown>) {
      return createAuthAction({
        schema: LoginInputSchema,
        checkboxes: ["rememberMe"] as const,
        invalidFieldsMessage: "Enter your email and password",
        fallbackErrorMessage: "Invalid email or password.",
        logLabel: "login action",
        run: run as never,
        onSuccess: () => ({ ok: true })
      });
    }

    it("reads a ticked checkbox as true", async () => {
      const run = vi.fn(async () => ({ error: null }));
      const action = makeRememberAction(run);

      await action(fakeAuthEvent({ email: "a@example.com", password: "secret", rememberMe: "on" }));

      expect(run).toHaveBeenCalledWith(
        clientSentinel,
        { email: "a@example.com", password: "secret", rememberMe: true },
        expect.anything()
      );
    });

    it("reads an absent checkbox as false, not as a missing field", async () => {
      const run = vi.fn(async () => ({ error: null }));
      const action = makeRememberAction(run);

      const result = await action(fakeAuthEvent({ email: "a@example.com", password: "secret" }));

      expect(result).toEqual({ ok: true });
      expect(run).toHaveBeenCalledWith(
        clientSentinel,
        { email: "a@example.com", password: "secret", rememberMe: false },
        expect.anything()
      );
    });

    it("still fails a missing required field when the checkbox is ticked", async () => {
      const run = vi.fn(async () => ({ error: null }));
      const action = makeRememberAction(run);

      const result = await action(fakeAuthEvent({ email: "a@example.com", rememberMe: "on" }));

      expect(result).toMatchObject({
        status: 400,
        data: { fieldErrors: { password: "Enter your password" } }
      });
      expect(run).not.toHaveBeenCalled();
    });
  });

  it("merges failureData into a Better Auth failure, so a multi-step route keeps its step", async () => {
    const action = createAuthAction({
      schema: LoginInputSchema,
      invalidFieldsMessage: "Enter your email and password",
      fallbackErrorMessage: "Invalid email or password.",
      logLabel: "login action",
      run: (async () => ({ error: {} })) as never,
      onSuccess: (() => ({ ok: true })) as never,
      failureData: ((values: Partial<Record<"email" | "password", string>>) => ({
        email: values.email ?? ""
      })) as never
    });

    const result = await action(fakeAuthEvent({ email: "a@example.com", password: "nope" }));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "Invalid email or password.", email: "a@example.com" }
    });
  });
});
