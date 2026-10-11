import { expect, it } from "vitest";

// Throwaway probe for #381: never merged.
it("fails only on embedded Postgres (the unit-test side)", () => {
  expect(process.env.TEST_DATABASE_URL).toBeTruthy();
});

it("fails only on a real server (the Real Postgres side)", () => {
  expect(process.env.TEST_DATABASE_URL).toBeUndefined();
});
