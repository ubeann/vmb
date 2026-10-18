import { beforeEach, describe, expect, it, vi } from "vitest";

const getMyProfileMock = vi.fn();
const updateMyProfileMock = vi.fn();
const configs: Array<{
  submit: (client: unknown, data: unknown, event: unknown) => unknown;
  redirectTo: (record: { id: string }) => string;
}> = [];

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — mock the specifiers the route itself imports.
vi.mock("$lib/api-access.js", () => ({
  withApiClient: async (_event: unknown, run: (client: unknown) => Promise<unknown>) => {
    try {
      return { ok: true, value: await run({}) };
    } catch (error) {
      return { ok: false, error };
    }
  }
}));
vi.mock("$lib/master/api.js", () => ({
  getMyProfile: (...args: unknown[]) => getMyProfileMock(...args),
  updateMyProfile: (...args: unknown[]) => updateMyProfileMock(...args),
  pageErrorStatus: (status: number) => (status === 403 || status === 404 ? status : 500)
}));
vi.mock("$lib/master/form-action.js", () => ({
  createMasterFormAction: (config: (typeof configs)[number]) => {
    configs.push(config);
    return vi.fn();
  }
}));
vi.mock("$lib/master/form-data.js", () => import("../../../lib/master/form-data.js"));
vi.mock("sveltekit-superforms/server", () => ({
  superValidate: async (data: unknown) => ({ data })
}));
vi.mock("sveltekit-superforms/adapters", () => ({ zod4: (schema: unknown) => schema }));

const route = await import("./+page.server.js");

const STAMP = "2026-10-05T03:04:00.123Z";
const profile = {
  id: "u-1",
  name: "Rina Wijaya",
  email: "rina@vmblogistics.id",
  phone: "+628111000001",
  profilePhotoPath: null,
  updatedAt: STAMP
};

const eventFor = (url = "http://localhost/profile") => ({ url: new URL(url) }) as never;

beforeEach(() => {
  getMyProfileMock.mockReset().mockResolvedValue({ ok: true, value: profile });
  updateMyProfileMock.mockReset();
});

describe("the profile route's load", () => {
  it("loads the caller's own name, phone and photo into the form, and their email beside it", async () => {
    const data = await route.load(eventFor());

    expect(data).toMatchObject({
      email: "rina@vmblogistics.id",
      saved: false,
      stamp: STAMP,
      form: { data: { name: "Rina Wijaya", phone: "+628111000001", profilePhotoPath: "" } }
    });
  });

  it("does not put the email in the form, so nothing can post one", async () => {
    const data = (await route.load(eventFor())) as { form: { data: object } };

    expect(Object.keys(data.form.data).sort()).toEqual(["name", "phone", "profilePhotoPath"]);
  });

  it("says a save happened when it is sent back with ?saved", async () => {
    await expect(route.load(eventFor("http://localhost/profile?saved"))).resolves.toMatchObject({
      saved: true
    });
  });

  it("answers an unavailable account 403 and an unreachable API 500", async () => {
    getMyProfileMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "This account is unavailable. Contact an administrator."
    });
    await expect(route.load(eventFor())).rejects.toMatchObject({ status: 403 });

    getMyProfileMock.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(route.load(eventFor())).rejects.toMatchObject({ status: 500 });
  });
});

describe("the profile route's action", () => {
  it("saves through the caller's own endpoint and comes back to the page", async () => {
    const [config] = configs;
    const data = { name: "Rina W.", phone: "+628111000002", profilePhotoPath: "" };

    await config!.submit({ client: true }, data, {});

    expect(updateMyProfileMock).toHaveBeenCalledWith({ client: true }, data);
    expect(config!.redirectTo({ id: "u-1" })).toBe("/profile?saved");
  });
});
