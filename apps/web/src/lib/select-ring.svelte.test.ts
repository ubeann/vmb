import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; the ring colour comes from it.
import "../app.css";

import { render } from "vitest-browser-svelte";
import SelectRing from "./select-ring-fixture.svelte";

afterEach(() => document.documentElement.classList.remove("dark"));

// The registry's select trigger has the same half-strength ring as its inputs;
// app.css lifts it to the full colour (#208).
it.each(["light", "dark"] as const)(
  "draws the select trigger in the full ring colour, %s",
  async (scheme) => {
    document.documentElement.classList.toggle("dark", scheme === "dark");
    const screen = await render(SelectRing);

    const trigger = screen.getByLabelText("Division").element();
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger);
    expect(getComputedStyle(trigger).getPropertyValue("--tw-ring-color").trim()).toBe(
      getComputedStyle(document.documentElement).getPropertyValue("--ring").trim()
    );
  }
);
