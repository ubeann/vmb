# Auth forms: field icons, hints and button icons — design round

A short round on the login and activate forms (issue #234), run by the steps of the [design workflow](../../agents/design-workflow.md) that apply to a change with no new art: compare, measure, owner review. No brief, territory or Recraft step: nothing here is new imagery, and no token changes.

## What ships

| Where                     | Leading field icon | Hint placeholder   | Button icon                         |
| ------------------------- | ------------------ | ------------------ | ----------------------------------- |
| Login, Email              | `mail`             | `name@company.com` |                                     |
| Login, Password           | `lock-keyhole`     | none               |                                     |
| Login, Log in             |                    |                    | `log-in`                            |
| Activate, Email           | `mail`             | `name@company.com` |                                     |
| Activate, Send code       |                    |                    | `send`                              |
| Activate, Code            | `key-round`        | `123456`           |                                     |
| Activate, New password    | `lock-keyhole`     | none               |                                     |
| Activate, Set password    |                    |                    | `check` (static)                    |
| Activate, Send a new code |                    |                    | none: an outline button, words only |

Icons are static Lucide, decorative and `aria-hidden` (ADR-0035 rule 3). The loading state swaps the icon for the spinner and keeps its text, so the button never relies on motion (rule 6).

`IconInput` (`$lib/components/IconInput.svelte`) is the one place that draws a leading icon: the field's own `relative` wrapper, the icon `pointer-events-none` at `left-3`, and `pl-9` on the input, which leaves 8px between the icon and the text. It also takes a `trailing` snippet drawn inside the same wrapper, which `PasswordInput` uses for the eye toggle, so the password fields share the geometry and there is one wrapper, not two.

## Decisions

- **Field and button icons: keep.** Compared with and without at the review viewports (`captures/`). The icons don't crowd the etched look: they are 16px, in the muted text colour, and the left-aligned mail and lock glyphs give the two inputs a visible rhythm that the plain fields lack. The button icon reads as a quiet prefix to the label.
- **Heading icon: drop, on both pages.** Tried `log-in` beside "Log in" and `lock` beside "Set your password", both at 28px (`captures/compare-*`). The 1.75px Lucide stroke is much lighter than Newsreader's display weight and reads as a stray glyph rather than part of the word. On Log in it repeats the button's own icon a few lines lower; on Set your password it repeats the lock of the field below and sits beside the word "password" that already says it. Not built. Revisit only with a bespoke, etched-weight mark, which is a new-art decision and out of this ticket's scope.
- **Hint wording.** `name@company.com` shows the shape without sounding like a real address on the sheet; `123456` shows the length (the schema requires exactly six digits) and keeps the field's mono, wide-tracked style. Both are hints, never labels: every field keeps its visible `<Label>`, and the code field keeps its "Use the code from your email." helper. Password fields get none, since a placeholder there reads like a filled-in value of dots or, worse, a real password.
- **The error state works with the leading icon.** Checked by submitting the empty login form and the empty code step, light and dark (`captures/login-error-*`, and the third panel of `captures/compare-activate-*`). The icon sits inside the input's box, so `aria-invalid`'s red border and ring (#231) wrap it, and the message stays below the wrapper as before. The icon keeps the muted colour rather than turning red: the border and message carry the state. `IconInput`'s test asserts the icon stays inside an `aria-invalid` field's box.

## Measurements

Chromium 1440 × 900, dev build, read after the input's colour transition has settled. Contrast is the colour over the input's real fill (the dark fill composited over the card), against the ≥ 4.5:1 minimum for text and 3:1 for icons (ADR-0035 rule 6).

| Pair                          | Light  | Dark   |
| ----------------------------- | ------ | ------ |
| Email placeholder on input    | 6.37:1 | 5.83:1 |
| Code hint (`123456`) on input | 6.37:1 | 5.83:1 |
| Leading icons on input        | 6.37:1 | 5.83:1 |

All three use `--muted-foreground` (the existing `placeholder:text-muted-foreground` and the icon's own class), so no new colour. An earlier reading of 7.62:1 for the dark email row was taken mid-transition, right after switching to dark, and was wrong.

**Layout shift, the regression #197 caught.** On the login form and on both activate steps (email; code and new password), at 1440 × 900 and 390 × 844, I appended a zero-height in-flow element and a 24px absolutely positioned "badge" after each input, as a password manager does. The form heights, every input, every leading icon and the eye toggle kept exactly the same rectangles. The badge never touched a leading icon. The code step was reached by stubbing the action's response in the browser, since the real one needs the API.

**Open item for owner review:** a synthetic badge pinned to the right edge of a password field does overlap the eye toggle, because both live at the field's right edge. That was already so before this ticket (the toggle and its `pr-12` are unchanged), and a headless probe can't tell where 1Password or Bitwarden actually put their button. The check that matters is in the owner's browser (below); if a real badge covers the eye, the fix is a wider `pr-*` on `PasswordInput` or moving the toggle, not anything in the leading icon.

## Viewports

The login page and the activate code step were captured at all six review viewports, light and dark, and every one of the 24 was looked at as a contact sheet. The icons hold at every width; the fields keep their 44px height, so no page grew: 1366 × 768 and 390 × 844 scroll (773px and 960px on login), and the page height is identical with and without the icons. The captures themselves aren't committed, except the side-by-side sheets that decided the open questions: `captures/` has login at 1440 × 900 and 390 × 844, and activate at 1440 × 900, light and dark, each without icons, with icons and with the heading icon, plus the error states.

## Owner review

To do, in the owner's own browser at native size, with their extensions installed:

- [ ] Login and activate, light and dark: the icons and hints read well and don't crowd the etched look.
- [ ] 1Password / Bitwarden badges: no overlap with the leading icon, none with the eye toggle, no layout shift.
- [ ] An error state (submit empty): the red border wraps the icon and the message reads as before.
