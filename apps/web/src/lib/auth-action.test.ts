import { beforeEach, describe, expect, it, vi } from "vitest";

const withAuthApiClientMock = vi.fn();

vi.mock("./api-access.js", () => ({
  withAuthApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withAuthApiClientMock(event, run)
}));

const { createAuthAction } = await import("./auth-action.js");

const clientSentinel = { kind: "auth" };

function fakeEvent(fields: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);

  return {
    request: new Request("http://localhost/login", { method: "POST", body: form }),
    url: new URL("http://localhost/login"),
    platform: undefined,
    fetch: vi.fn()
  } as never;
}

type Run = (
  client: unknown,
  values: { email: string; password: string },
  event: unknown
) => Promise<{ error?: { message?: string } | null }>;

function makeAction(
  run: Run = async () => ({ error: null }),
  onSuccess: () => unknown = () => ({ ok: true })
) {
  return createAuthAction({
    fields: ["email", "password"] as const,
    missingFieldsMessage: "Email and password are required.",
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

    const result = await action(fakeEvent({ email: "a@example.com" }));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "Email and password are required." }
    });
    expect(run).not.toHaveBeenCalled();
    expect(withAuthApiClientMock).not.toHaveBeenCalled();
  });

  it("treats an empty string as a missing field", async () => {
    const action = makeAction();

    const result = await action(fakeEvent({ email: "", password: "secret" }));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "Email and password are required." }
    });
    expect(withAuthApiClientMock).not.toHaveBeenCalled();
  });

  it("maps a transport failure to the shared 500 message and logs it", async () => {
    const error = new Error("network down");
    withAuthApiClientMock.mockResolvedValueOnce({ ok: false, error });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const action = makeAction();

    const result = await action(fakeEvent({ email: "a@example.com", password: "secret" }));

    expect(result).toMatchObject({
      status: 500,
      data: { error: "Something went wrong. Please try again." }
    });
    expect(consoleError).toHaveBeenCalledWith("login action: request to API failed", error);
    consoleError.mockRestore();
  });

  it("uses the Better Auth error's message when it has one", async () => {
    const action = makeAction(async () => ({ error: { message: "Invalid email or password" } }));

    const result = await action(fakeEvent({ email: "a@example.com", password: "nope" }));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "Invalid email or password" }
    });
  });

  it("falls back to the route's error when Better Auth reports none", async () => {
    const action = makeAction(async () => ({ error: {} }));

    const result = await action(fakeEvent({ email: "a@example.com", password: "nope" }));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "Invalid email or password." }
    });
  });

  it("passes the built client, validated values, and the event to the route's call", async () => {
    const run = vi.fn<Run>(async () => ({ error: null }));
    const action = makeAction(run);
    const event = fakeEvent({ email: "a@example.com", password: "secret" });

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
      action(fakeEvent({ email: "a@example.com", password: "secret" }))
    ).resolves.toEqual({ success: true });
  });
});
