# ADR-0046: Type — Schibsted Grotesk for UI, Newsreader's display cut, JetBrains Mono for codes

**Context:** ADR-0035 set Inter for all text, and ADR-0036 added Newsreader for display headings. The 2026-10-06 critique of the auth pages (the impeccable pilot, `docs/design/etched-login/README.md`) found that the engraved frame is VMB's own, but the type inside the form sheet reads as a stock template. There were three causes:

- **Inter everywhere.** Every role in the sheet was Inter at 14px, told apart only by weight and colour: description, label, input, button, link, hint, error and footer.
- **Newsreader's text cut at display sizes.** `@fontsource-variable/newsreader` loads only the weight axis, so its optical-size axis stays at 16. The 60px brand line and the 30px headings were drawn with the body-text cut, which has heavier hairlines and looser spacing.
- **Untreated figures.** The one-time code was 16px proportional Inter, and the resend countdown's width changed every second.

The owner asked for type that doesn't feel generic, across the whole app.

**Options considered:** each face was rendered on the real `/login` and `/activate` pages, light and dark, at 1440 × 900 and 390 × 844. Captures are in the round's README.

- **Display**
  - Newsreader's optical-size cut was chosen.
  - Bodoni Moda and Marcellus are wider and wrap the brand line to three lines at 1440. That moves the flock and breaks the headroom tiers `AuthShell` measures against a two-line brand line.
  - Forum is a single, light weight and reads thin at 30px in the sheet.
  - Asul is darker and wider, and runs the brand line toward the sky's clear zone.
  - Larken was not rendered. It is a paid face (Ellen Luff Type Foundry, or Adobe Fonts' hosted kit), so it could not be self-hosted without buying a licence.
- **UI**
  - Schibsted Grotesk was chosen.
  - Inter was kept as the baseline.
  - Switzer is free under ITF's licence, which forbids redistribution, so it would have to leave the repository if the repository ever went public.
  - Rethink Sans was also rendered.
  - Libre Franklin and Archivo came from the first round. Libre Franklin's shipped subset has no tabular figures, which rules it out for data tables (ADR-0035 rule 5).
- **Codes and figures**
  - JetBrains Mono was chosen.
  - The UI face's tabular figures, IBM Plex Mono, Red Hat Mono and Martian Mono were also rendered.

**Decision:** three faces, app-wide, each loaded from `@fontsource-variable` and named by one token in `apps/web/src/app.css`:

- **`--font-sans`: Schibsted Grotesk Variable** (weights 400–900), for all UI text. Schibsted is a newspaper grotesque: plain enough for dense forms and tables, with more character than Inter. Its figures switch to tabular with `tabular-nums`, as ADR-0035 rule 5 requires for numeric columns.
- **`--font-display`: Newsreader Variable, optical-size cut** (`@fontsource-variable/newsreader/opsz.css`). It is for display headings only, never for running text: a description that wraps to two lines or more stays in the UI face. `font-optical-sizing` is the browser default (`auto`), so each heading gets the cut for its size.
- **`--font-mono`: JetBrains Mono Variable**, for codes and figures that are read character by character: the one-time code, the resend countdown, and Master codes already set in `font-mono`. Its 0/O and 1/l/I are unambiguous.

`hooks.server.ts` preloads the latin Schibsted and Newsreader optical-size files on every page, replacing the Inter and Newsreader weight-axis files (the ADR-0036 amendment's rule, with new file names). JetBrains Mono is not preloaded; the browser fetches it only when a page shows `font-mono` text.

| Latin woff2                                    | Before | After  |
| ---------------------------------------------- | ------ | ------ |
| UI face (Inter → Schibsted Grotesk)            | 48 kB  | 47 kB  |
| Display face (Newsreader weight → optical cut) | 58 kB  | 132 kB |
| Preloaded per page                             | 106 kB | 179 kB |
| JetBrains Mono, only on pages with `font-mono` | —      | 40 kB  |

ADR-0035's "Inter Variable" and ADR-0036's "Newsreader Variable (weight axis, 57 kB latin woff2)" are superseded by this record. Their other rules stand.

**Trade-offs:**

- **Page weight.** The preloaded fonts grow by 73 kB on a page's first visit. All of it comes from Newsreader's optical-size axis, which is the change that makes the display type read as engraved rather than default. Subsetting the display cut to the glyphs the headings use was considered and left for later: headings are page content, so a subset would miss characters as copy changes and when the planned Bahasa Indonesia translation lands. The files are immutable, so a repeat visit pays nothing.
- **Re-measuring the auth frame.** Schibsted's metrics differ from Inter's, so the auth frame's fit was re-measured at the review viewports (design-workflow step 6).
- **A second font family to manage.** The mono face is one more family, but it costs nothing on pages that don't show a code.
