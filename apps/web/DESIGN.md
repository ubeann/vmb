---
name: VMB
description: Every crate, container and receipt, on record.
colors:
  background: "oklch(0.979 0.007 88.6)"
  foreground: "oklch(0.247 0.094 267.7)"
  card: "oklch(1 0 0)"
  primary: "oklch(0.51 0.164 143.6)"
  primary-hover: "oklch(0.46 0.15 143.6)"
  primary-foreground: "oklch(0.982 0.01 145.5)"
  primary-edge: "oklch(0.42 0.135 143.6)"
  secondary: "oklch(0.95 0.01 273.4)"
  muted: "oklch(0.946 0.004 90)"
  muted-foreground: "oklch(0.488 0.052 273.5)"
  accent: "oklch(0.93 0.005 90)"
  success: "oklch(0.45 0.12 152)"
  warning: "oklch(0.47 0.11 62)"
  destructive: "oklch(0.53 0.207 22.3)"
  border: "oklch(0.888 0.005 90)"
  input: "oklch(0.64 0.037 274.3)"
  ring: "oklch(0.51 0.164 143.6)"
  etching: "oklch(0.36 0.12 266)"
  brand-mark: "oklch(0.289 0.151 264.6)"
  background-dark: "oklch(0.19 0.064 271)"
  foreground-dark: "oklch(0.954 0.011 95.2)"
  card-dark: "oklch(0.237 0.076 271)"
  primary-dark: "oklch(0.75 0.165 146.3)"
  primary-hover-dark: "oklch(0.79 0.16 146.3)"
  primary-foreground-dark: "oklch(0.237 0.062 146.7)"
  primary-edge-dark: "oklch(0.6 0.14 146.3)"
  secondary-dark: "oklch(0.284 0.082 271.7)"
  muted-dark: "oklch(0.274 0.084 272.2)"
  muted-foreground-dark: "oklch(0.754 0.04 273.9)"
  accent-dark: "oklch(0.284 0.082 271.7)"
  success-dark: "oklch(0.78 0.15 152)"
  warning-dark: "oklch(0.82 0.13 75)"
  destructive-dark: "oklch(0.712 0.181 22.8)"
  border-dark: "oklch(0.322 0.08 272.6)"
  input-dark: "oklch(0.501 0.076 274.2)"
  ring-dark: "oklch(0.75 0.165 146.3)"
  etching-dark: "oklch(0.63 0.095 272)"
  brand-mark-dark: "oklch(0.954 0.011 95.2)"
typography:
  brand-line:
    fontFamily: "Newsreader Variable, Georgia, serif"
    fontSize: "3.75rem"
    fontWeight: 400
    lineHeight: 1.05
  heading:
    fontFamily: "Newsreader Variable, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 500
  body:
    fontFamily: "Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  code:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "1.375rem"
    fontWeight: 500
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
---

# Design

This file is a map for design tools, impeccable in particular. It owns nothing. `src/app.css` holds every token, the ADRs hold the decisions, and `/design-system` shows them rendered. The header above mirrors `app.css` so impeccable's live panel can draw swatches; `design-md.test.ts` fails when the two drift apart. Change a token in `app.css` and its ADR first, then here.

## Overview

An engraved plate: navy ink and the logo green on warm paper, with line-engraved art drawn as token-filled masks. The auth and error pages carry the art; signed-in pages are plain, dense record-keeping screens in the same palette and type. Product context, users and principles are in `PRODUCT.md`. The look is defined by `docs/design/etched-login/README.md` and the rounds after it in `docs/design/`.

## Colors

Semantic tokens from shadcn-svelte, filled with VMB's palette (ADR-0035, ADR-0036). Keys ending in `-dark` are the `.dark` values. ADR-0036 lists the measured contrast pairs. `etching` is the engraving ink and `brand-mark` the logo navy; art takes its colour from these, never from a literal.

## Typography

Three faces, app-wide (ADR-0046): Schibsted Grotesk for UI text, Newsreader's optical-size cut for display headings only, JetBrains Mono for codes and figures read character by character. Numeric columns use tabular figures (ADR-0035 rule 5). The sizes above are the auth pages' largest steps; the brand line and headings step down on small screens.

## Layout

Review viewports and layout rules are in `docs/agents/design-workflow.md`. Signed-in pages take one of three widths, centred inside the white panel, list tables fit their utility columns to content, and the top bar's slot order is fixed (ADR-0050). Lists follow the list kit's rules: views as tabs in the card, one Filter panel, chips for filters in use, and a card that folds its columns by its own width (ADR-0051). Panels, dialogs and sheets change frame at 480 and 640px and reset when closed (ADR-0053); keyboard shortcuts live in one app-wide sheet (ADR-0052). The form comes first: usable before its art loads, each input in its own wrapper so extension-injected elements don't move it. Touch pointers get 44px targets.

## Elevation & Depth

Depth is mostly flat: a white card on warm paper, a navy card on deep navy in dark mode, separated by a `border` rule. The one raised element is the primary button: a sheen over the green, a lit top edge and a darker `primary-edge` border (ADR-0036, "Primary button texture"). Other buttons stay flat. A signed-in page in light mode is two layers: the warm frame (sidebar, top bar, footer) round a white panel (`card`), with its tables on the same white (ADR-0036, "Signed-in panel"). The auth sheet is framed like a plate, with a double rule (`card`, then `border`) and one soft shadow tinted with `etching` (`AuthShell.svelte`).

## Shapes

One radius, `--radius` (0.625rem), with the Tailwind steps derived from it in `app.css`. Controls round by a quarter of their height (`rounded-(--control-radius)`): 8px at 32px, 11px once touch pointers grow them to 44px, filter chips included; a card is one step rounder (`rounded-xl`, 14px) than what it holds, and popovers and menus keep their own (ADR-0035, 2026-10-11). In light mode, text fields and outline buttons share one skin: the paper's fill and `--control-edge`, a mix of 45% `input` into `border` that the header leaves out because it is derived, not a value of its own.

## Components

shadcn-svelte components restyled on these tokens (ADR-0035). VMB's own pieces live in `src/lib/components/`: `AuthShell` and `AuthCard` frame the auth pages, `EtchedScene` and `EtchedMark` draw the art. Motion uses the tokens in `app.css` and CSS or Svelte built-ins only (ADR-0040).

## Do's and Don'ts

- Do keep the etched look on the auth and error pages; a redesign starts a new round in `docs/design/`.
- Do take every colour, duration and easing from an `app.css` token. A new colour gets a token in both `:root` and `.dark`, and an ADR.
- Do play motion once. Entrance motion settles and stops; reduced motion shows the finished state. Feedback for the user's own action may play near a field, within the motion tokens.
- Don't put ambient motion near a focused field.
- Don't place ornaments under text; keep a clear zone of at least 2.5rem around it.
- Don't use em dashes in interface copy.
- Don't show warehouse, trucking and expense as one connected flow; they are three separate places.
