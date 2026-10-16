import { DivisionInputSchema, DivisionUpdateInputSchema } from "@vmb/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const withApiClientMock = vi.fn();

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — mock the access seam the module imports.
vi.mock("$lib/api-access.js", () => ({
  withApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withApiClientMock(event, run)
}));

const { createMasterFormAction, runRowAction } = await import("./form-action.js");

function fakeEvent(fields: Record<string, string> = {}, url = "http://localhost/master/divisions") {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);

  return {
    request: new Request(url, { method: "POST", body: form }),
    url: new URL(url),
    platform: undefined,
    fetch: () => {
      throw new Error("unexpected fetch");
    }
  } as never;
}

const submitted = {
  name: "Operations",
  code: "OPS",
  description: "",
  colorHex: "#2563EB",
  iconName: "settings",
  isActive: "on"
};

const submit = vi.fn();
const action = createMasterFormAction({
  schema: DivisionInputSchema,
  logLabel: "test division create",
  submit: (client, data, event) => submit(client, data, event),
  redirectTo: (record) => `/master/divisions/${record.id}`
});

beforeEach(() => {
  withApiClientMock.mockReset();
  submit.mockReset();
  withApiClientMock.mockImplementation(
    async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
      ok: true,
      value: await run({})
    })
  );
});

describe("createMasterFormAction", () => {
  it("fails a submitted form that does not match the shared schema", async () => {
    const result = await action(fakeEvent({ name: "", code: "O", colorHex: "blue" }));

    expect(result).toMatchObject({
      status: 400,
      data: { form: { valid: false } }
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it("passes the parsed values to the API", async () => {
    submit.mockResolvedValue({ ok: true, value: { id: "d1000000-0000-4000-8000-000000000001" } });

    await expect(action(fakeEvent(submitted))).rejects.toMatchObject({
      status: 303,
      location: "/master/divisions/d1000000-0000-4000-8000-000000000001"
    });

    expect(submit).toHaveBeenCalledWith(
      {},
      {
        name: "Operations",
        code: "OPS",
        description: "",
        colorHex: "#2563EB",
        iconName: "settings",
        isActive: true
      },
      expect.anything()
    );
  });

  it("reads an unchecked checkbox as inactive", async () => {
    const withoutActive = {
      name: "Operations",
      code: "OPS",
      description: "",
      colorHex: "#2563EB",
      iconName: "settings"
    };
    submit.mockResolvedValue({ ok: true, value: { id: "d1000000-0000-4000-8000-000000000001" } });

    await expect(action(fakeEvent(withoutActive))).rejects.toMatchObject({ status: 303 });

    expect(submit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ isActive: false }),
      expect.anything()
    );
  });

  it("puts the API's domain error on the form", async () => {
    submit.mockResolvedValue({
      ok: false,
      status: 409,
      code: "CONFLICT",
      error: "A division with that name already exists.",
      issues: []
    });

    const result = await action(fakeEvent(submitted));

    expect(result).toMatchObject({
      status: 409,
      data: { form: { message: "A division with that name already exists." } }
    });
  });

  it("puts each issue the API named on its field", async () => {
    const taken = { path: "code", message: "A division with that code already exists." };
    submit.mockResolvedValue({
      ok: false,
      status: 409,
      code: "CONFLICT",
      error: taken.message,
      issues: [taken]
    });

    const result = await action(fakeEvent(submitted));

    expect(result).toMatchObject({
      status: 409,
      data: { form: { valid: false, errors: { code: [taken.message] } } }
    });
  });

  it("reports a transport failure as a 500 form message", async () => {
    withApiClientMock.mockResolvedValue({ ok: false, error: new Error("offline") });

    const result = await action(fakeEvent(submitted));

    expect(result).toMatchObject({
      status: 500,
      data: { form: { message: "Something went wrong. Please try again." } }
    });
  });
});

describe("createMasterFormAction on an edit", () => {
  const STAMP = "2026-01-05T01:10:00.123Z";
  const editAction = createMasterFormAction({
    schema: DivisionUpdateInputSchema,
    logLabel: "test division update",
    submit: (client, data, event) => submit(client, data, event),
    redirectTo: (record) => `/master/divisions/${record.id}`
  });

  it("passes the updatedAt the form carried to the API as it was served", async () => {
    submit.mockResolvedValue({ ok: true, value: { id: "d1000000-0000-4000-8000-000000000001" } });

    await expect(editAction(fakeEvent({ ...submitted, updatedAt: STAMP }))).rejects.toMatchObject({
      status: 303
    });

    expect(submit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ updatedAt: STAMP }),
      expect.anything()
    );
  });

  it("reads an empty updatedAt as a record that was never stamped", async () => {
    submit.mockResolvedValue({ ok: true, value: { id: "d1000000-0000-4000-8000-000000000001" } });

    await expect(editAction(fakeEvent({ ...submitted, updatedAt: "" }))).rejects.toMatchObject({
      status: 303
    });

    expect(submit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ updatedAt: null }),
      expect.anything()
    );
  });

  it("refuses an updatedAt that is not a timestamp, without calling the API", async () => {
    const result = await editAction(fakeEvent({ ...submitted, updatedAt: "yesterday" }));

    expect(result).toMatchObject({ status: 400, data: { form: { valid: false } } });
    expect(submit).not.toHaveBeenCalled();
  });

  it("keeps the submitted input and puts a stale record's conflict on updatedAt", async () => {
    const message = "This record was changed by someone else since you opened it.";
    submit.mockResolvedValue({
      ok: false,
      status: 409,
      code: "STALE_RECORD",
      error: message,
      issues: [{ path: "updatedAt", message }]
    });

    const result = await editAction(fakeEvent({ ...submitted, name: "My edit", updatedAt: STAMP }));

    expect(result).toMatchObject({
      status: 409,
      data: {
        form: {
          data: { name: "My edit", code: "OPS", updatedAt: STAMP },
          errors: { updatedAt: [message] },
          message
        }
      }
    });
  });
});

describe("runRowAction", () => {
  const run = vi.fn();

  function idEvent(id?: string) {
    const form = new FormData();
    if (id) form.set("id", id);
    return {
      request: new Request("http://localhost/master/divisions", { method: "POST", body: form }),
      url: new URL("http://localhost/master/divisions"),
      platform: undefined,
      fetch: () => {
        throw new Error("unexpected fetch");
      }
    } as never;
  }

  beforeEach(() => {
    run.mockReset();
    withApiClientMock.mockImplementation(
      async (_event: unknown, fn: (client: unknown) => Promise<unknown>) => ({
        ok: true,
        value: await fn({})
      })
    );
  });

  it("fails when the form carried no id", async () => {
    const result = await runRowAction(idEvent(), { logLabel: "test", run });

    expect(result).toMatchObject({ status: 400, data: { error: "Missing record id." } });
    expect(run).not.toHaveBeenCalled();
  });

  it("runs the action with the submitted id", async () => {
    run.mockResolvedValue({ ok: true, value: null });

    await expect(
      runRowAction(idEvent("d1000000-0000-4000-8000-000000000001"), { logLabel: "test", run })
    ).resolves.toMatchObject({ ok: true });
    expect(run).toHaveBeenCalledWith({}, "d1000000-0000-4000-8000-000000000001");
  });

  it("maps a domain failure to its status", async () => {
    run.mockResolvedValue({
      ok: false,
      status: 403,
      code: "SYSTEM_ROLE",
      error: "System roles cannot be modified.",
      issues: []
    });

    const result = await runRowAction(idEvent("d1000000-0000-4000-8000-000000000001"), {
      logLabel: "test",
      run
    });

    expect(result).toMatchObject({
      status: 403,
      data: { error: "System roles cannot be modified.", code: "SYSTEM_ROLE" }
    });
  });
});
