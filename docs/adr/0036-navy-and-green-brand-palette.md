# ADR-0036: Brand palette — the logo's navy and green on warm paper

**Context:** ADR-0035 themed the design system with shadcn-svelte's generated `teal` on a cool-grey `mist` neutral. Teal was a registry default, not VMB's colour: the logo (`vmb-warehouse/public/img/logo.png`) is a navy swoosh (`#041c74`) with green striped letterforms (`#087c16`). The login redesign introduced an engraved illustration that needs its own ink colour, and it made the mismatch visible: a teal page under a navy-and-green mark. The logo's horizontal stripes also suggest engraving line work, which is what the new auth pages use.

**Options considered:**

- Keep teal and draw the illustration in teal ink: no token churn, but the app's only brand colours would still come from the registry.
- Navy as `--primary`: matches the logo's dominant colour, but navy buttons on navy text blur the difference between action and content.
- Navy ink for text and illustration, the logo green as `--primary`, on a warm paper neutral.

**Decision:** The third option. ADR-0035's rules are unchanged; only the values in `apps/web/src/app.css` change, for both `:root` and `.dark`:

- **Text** is navy ink (`--foreground`, light L 0.247 H 268) on warm paper (`--background`, `#faf8f3`). Cards stay white, so a card reads as a sheet laid on the paper.
- **`--primary` and `--ring` are the logo green** `#087c16`: 5.1:1 under white button text and 5.1:1 as link text on paper. In dark mode they become a lighter green with dark text (7.8:1 as a fill, 8.9:1 as a link on the navy background).
- **`--input` is darkened to 3:1** against both paper (3.18:1) and white (3.38:1). This retires ADR-0035's known exception: field boundaries now meet the 3:1 non-text contrast target on their own. (Reopened for outline buttons and list-kit fields by ADR-0035's 2026-10-11 amendment, which gives them a softer `--control-edge`; form fields keep `--input`.)
- **New token `--etching`** is the ink for engraved illustrations: the logo navy eased toward paper in light mode (L 0.36) and a muted periwinkle on dark navy (L 0.63). Illustrations ship as alpha masks filled with this token, so one asset serves both schemes (see `EtchedScene.svelte`).
- **New token `--brand-mark`** colours the logo's swoosh: the logo navy in light mode and paper on the dark navy background, where the original navy would disappear. The logo's green stripes use `--primary`.
- **Transactional emails** (`apps/api/src/email.ts`) carry hex equivalents of the light palette, since email clients support neither CSS variables nor OKLCH.
- **New font token `--font-display`**, Newsreader Variable (weight axis, 57 kB latin woff2), for display headings only. Body and UI text stay Inter.

Measured text pairs (WCAG 2.2 AA, target 4.5:1): foreground on paper 15.4:1, on white 16.4:1; muted text 6.0:1 on paper, 5.4:1 on `--muted`; destructive 5.5:1 on paper. Dark: foreground 16.3:1, muted 8.5:1, destructive 6.7:1.

**Trade-offs:** Every existing page changes colour at once, including the Master screens nobody has restyled yet. The benefit is that the product, the logo and the auth illustration now share one palette. Green as the primary colour competes with the green "success" meaning the app may want later; status stays text plus tone (ADR-0035 rule 5), and a separate success token can be added when a status needs one. Newsreader adds a second webfont, loaded only by pages that use `font-display`.

**Amendment (2026-10-06, #289):** `hooks.server.ts` now preloads the `latin` Inter and Newsreader files on every page, through the `preload` option of `resolve`. The browser only found them after reading the stylesheet, so the login headline's largest paint waited 1.8 s on a font it could have been fetching. The `latin-ext` files stay lazy. **Trade-off:** the "loaded only by pages that use `font-display`" line above no longer holds for the download itself: a page without a display heading still fetches Newsreader's 58 kB. Accepted because the auth pages, the error page and the dashboard all use `font-display`, and the files are immutable, so a repeat visit pays nothing.

**Amendment (2026-10-06):** `--font-display` now loads Newsreader's optical-size cut (132 kB latin), and the preloaded files are that cut and Schibsted Grotesk ([ADR-0046](0046-schibsted-newsreader-display-cut-and-jetbrains-mono.md)).

**Amendment (2026-10-07, #301): status tones.** The list kit's `StatusPill` needs a success and a warning tone, which the trade-off above deferred. Two new tokens, in `:root` and `.dark`:

| Token       | Light                  | Dark                   | Used for                        |
| ----------- | ---------------------- | ---------------------- | ------------------------------- |
| `--success` | `oklch(0.45 0.12 152)` | `oklch(0.78 0.15 152)` | Active                          |
| `--warning` | `oklch(0.47 0.11 62)`  | `oklch(0.82 0.13 75)`  | none yet (Suspended, with #304) |

- Success is a bluer green (hue 152) than `--primary` (143.6) and darker in light mode, so an Active pill doesn't read as a green button.
- A pill is the tone's text on a 12% wash of the same tone with a 30% border; neutral statuses (Inactive) use `--muted-foreground` on `--muted`. Status stays text plus tone (ADR-0035 rule 5), and `StatusPill.svelte` holds the one status→tone map.
- Measured (WCAG 2.2 AA, target 4.5:1), the text against the pill's own wash on each surface it sits on: light success 5.50:1 on paper, 5.82:1 on white, 5.01:1 on the `--muted` row hover; light warning 5.55, 5.87 and 5.06:1. Dark success 8.02:1 on the background, 7.08:1 on cards, 6.33:1 on `--muted`; dark warning 8.53, 7.53 and 6.73:1. The bare tone as text: light success 6.60:1 on paper, warning 6.64:1; dark 9.85 and 10.48:1.

**Amendment (2026-10-08, #343): signed-in panel.** The Divisions list (#301) showed light mode stacking three surfaces within about 3% lightness of each other: the frame (`--sidebar`, `#f6f3ed`), the page panel (`--background`, `#faf8f3`) and the table (`--card`, white). Five palettes were prototyped on the real pages (branch `prototype/light-mode-palette`): this one, a navy-tinted near-white for every surface, the same with a tinted canvas under white cards, a near-neutral grey, and this palette with a white panel. The last was chosen, because it fixes the layers and keeps the warm paper of the auth and error pages.

- **The signed-in panel is a white sheet on the warm frame.** `AppShell` paints it `bg-card` in light mode, so the page is two layers and the tables on it share its white. Dark mode keeps `bg-background`, because there `--card` is the sidebar's colour and would merge the panel into the frame. No colour token changes for this.
- **`--muted`, `--accent` and `--border` lose the paper's tint** (chroma 0.012–0.016 → 0.004–0.005, hue 90), because on white, between the cool navy text, they read as cream stripes. Their lightness is unchanged, so the pairs measured above hold: muted text 5.44:1 on `--muted`, the navy text 13.3:1 on `--accent`, the green focus ring 4.4:1 against it, the status pills 5.01:1 and 5.06:1 on `--muted`.
- **`--sidebar-accent` and `--sidebar-border` keep the warm values**, because they sit on the warm frame.
- The email hex colours follow (`muted` `#eeedea`, `border` `#dbdad6`).

**Amendment (2026-10-09): primary button texture.** The primary button was a flat fill. It now takes the texture of Cloudflare's Kumo button (`@cloudflare/kumo`, which derives a gradient, a lit top edge and a darker ring from one brand colour), in the logo green. Three strengths were compared side by side in light and dark; the middle one was chosen.

- **Kumo lightens the fill; VMB doesn't in light mode.** Kumo's top stop (brand + 15% white) and hover (+30% white) would put the white label at 3.8:1 and 2.9:1 on the logo green. In light mode the texture only darkens downward, so the label sits on `--primary` or darker. In dark mode, where the label is dark, the sheen lifts the top instead.
- **Four new tokens**, in `:root` and `.dark`: `--primary-sheen-top` and `--primary-sheen-bottom` (a translucent white or black laid over the fill), `--primary-highlight` (a 1px lit top edge) and `--primary-edge` (the border, a darker green).
- **One rule in `app.css`, none in the registry.** The sheen is a `background-image` over `--primary`, so the existing opaque hover shade takes it too. The lit edge uses Tailwind's inset-shadow slot of the same `box-shadow` list as the focus ring, so the two compose; a focused button keeps the ring-coloured border. Only `[data-slot="button"].bg-primary` takes it: linked badges, the outline, secondary, ghost and destructive buttons stay flat. The destructive button stays a tint, because a second solid button would compete with the form's one primary action (ADR-0035 rule 4). A primary link takes the texture by rendering `<Button href>`, which is `<a data-slot="button">`; `buttonVariants()` on a bare `<a>` has no `data-slot`, so it missed both this and the hover shade. The Divisions list's "New division" moved over.
- Measured on the rendered login button (WCAG 2.2 AA, target 4.5:1), the label against each pixel row of the middle half of the fill, where the text sits, worst row: light 5.39:1 at rest (was 5.12:1), 6.69:1 on hover; dark 6.99:1 at rest (was 7.79:1), 7.88:1 on hover. `contrast.mjs` compares against the most common pixel colour, which on a gradient is an arbitrary row or the border, so its figures here (5.54:1 and 6.75:1) don't track the label's band.

**Amendment (2026-10-13): the scrim.** One new token, in `:root` and `.dark`, for the backdrop behind every dialog and sheet (ADR-0053's 2026-10-13 amendment): `--scrim`. In light mode it is black at 40% (`oklch(0 0 0 / 0.4)`), which dims the warm page without tinting it. In dark mode it is `oklch(0.2 0.08 268 / 0.45)`, the navy, which deepens the navy frame without adding a second colour. There is no blur. The values are the prototype's starting points; fine-tuning them on the real page updates this amendment and the parity sheet.
