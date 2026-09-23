import { describe, expect, it } from "vitest";

const { load } = await import("./+layout.server.js");

function event(pathname: string, user: unknown) {
  return { locals: { user }, url: new URL(`http://localhost${pathname}`) } as never;
}

describe("the app layout guard", () => {
  it.each(["/", "/master", "/master/divisions", "/master/users/user-1"])(
    "redirects an unauthenticated request for %s to the login page",
    (pathname) => {
      let thrown: unknown;
      try {
        load(event(pathname, null));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toMatchObject({ status: 303, location: "/login" });
    }
  );

  it.each(["/login", "/activate", "/logout"])("leaves %s public", (pathname) => {
    expect(() => load(event(pathname, null))).not.toThrow();
  });

  it("lets a signed-in request through and hands the user to the layout", () => {
    expect(load(event("/master", { id: "user-1" }))).toMatchObject({ user: { id: "user-1" } });
  });
});
