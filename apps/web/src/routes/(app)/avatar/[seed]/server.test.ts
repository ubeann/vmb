import { describe, expect, it, vi } from "vitest";

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here; hand the route the real module under its specifier.
vi.mock("$lib/avatar.js", async () => await import("../../../../lib/avatar.js"));

const { GET } = await import("./+server.js");

const call = (seed: string, query = "") =>
  GET({ params: { seed }, url: new URL(`http://localhost/avatar/${seed}${query}`) } as never);

describe("GET /avatar/[seed]", () => {
  it("serves a cacheable SVG", async () => {
    const response = await call("u-1");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(await response.text()).toMatch(/^<svg/);
  });

  it("picks the theme and the motion from the query", async () => {
    const light = await (await call("u-1", "?theme=light")).text();
    const dark = await (await call("u-1", "?theme=dark")).text();
    const animated = await (await call("u-1", "?animated=1")).text();

    expect(light).not.toBe(dark);
    expect(animated).toContain("@keyframes");
  });

  it("refuses a seed that is too long", () => {
    let thrown: unknown;
    try {
      call("x".repeat(129));
    } catch (caught) {
      thrown = caught;
    }

    expect(thrown).toMatchObject({ status: 400 });
  });
});
