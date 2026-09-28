# ADR-0036: Brand palette — the logo's navy and green on warm paper

**Context:** ADR-0035 themed the design system with shadcn-svelte's generated `teal` on a cool-grey `mist` neutral. Teal was a registry default, not VMB's colour: the logo (`vmb-warehouse/public/img/logo.png`) is a navy swoosh (`#041c74`) with green striped letterforms (`#087c16`). The login redesign introduced an engraved illustration that needs its own ink colour, and it made the mismatch visible: a teal page under a navy-and-green mark. The logo's horizontal stripes also suggest engraving line work, which is what the new auth pages use.

**Options considered:**

- Keep teal and draw the illustration in teal ink: no token churn, but the app's only brand colours would still come from the registry.
- Navy as `--primary`: matches the logo's dominant colour, but navy buttons on navy text blur the difference between action and content.
- Navy ink for text and illustration, the logo green as `--primary`, on a warm paper neutral.

**Decision:** The third option. ADR-0035's rules are unchanged; only the values in `apps/web/src/app.css` change, for both `:root` and `.dark`:

- **Text** is navy ink (`--foreground`, light L 0.247 H 268) on warm paper (`--background`, `#faf8f3`). Cards stay white, so a card reads as a sheet laid on the paper.
- **`--primary` and `--ring` are the logo green** `#087c16`: 5.1:1 under white button text and 5.1:1 as link text on paper. In dark mode they become a lighter green with dark text (7.8:1 as a fill, 8.9:1 as a link on the navy background).
- **`--input` is darkened to 3:1** against both paper (3.18:1) and white (3.38:1). This retires ADR-0035's known exception: field boundaries now meet the 3:1 non-text contrast target on their own.
- **New token `--etching`** is the ink for engraved illustrations: the logo navy eased toward paper in light mode (L 0.36) and a muted periwinkle on dark navy (L 0.63). Illustrations ship as alpha masks filled with this token, so one asset serves both schemes (see `EtchedScene.svelte`).
- **New token `--brand-mark`** colours the logo's swoosh: the logo navy in light mode and paper on the dark navy background, where the original navy would disappear. The logo's green stripes use `--primary`.
- **Transactional emails** (`apps/api/src/email.ts`) carry hex equivalents of the light palette, since email clients support neither CSS variables nor OKLCH.
- **New font token `--font-display`**, Newsreader Variable (weight axis, 57 kB latin woff2), for display headings only. Body and UI text stay Inter.

Measured text pairs (WCAG 2.2 AA, target 4.5:1): foreground on paper 15.4:1, on white 16.4:1; muted text 6.0:1 on paper, 5.4:1 on `--muted`; destructive 5.5:1 on paper. Dark: foreground 16.3:1, muted 8.5:1, destructive 6.7:1.

**Trade-offs:** Every existing page changes colour at once, including the Master screens nobody has restyled yet. The benefit is that the product, the logo and the auth illustration now share one palette. Green as the primary colour competes with the green "success" meaning the app may want later; status stays text plus tone (ADR-0035 rule 5), and a separate success token can be added when a status needs one. Newsreader adds a second webfont, loaded only by pages that use `font-display`.
