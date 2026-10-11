# ADR-0052: App-wide keyboard shortcuts — one sheet, page sections, keyboard rows on by default, and a switch for single-key shortcuts

**Context:** The list-kit prototype ([ADR-0051](0051-list-kit-interaction-rules.md)) added row shortcuts to Divisions: ↑↓ or J/K to move a marked row, Enter to open it, and E, D, A, ⌫ and R for the row's actions. They were listed in a sheet of the list's own, opened by `?` and announced by a "Press ? for keyboard shortcuts" line under the table. Reviewing it, the owner found two problems: the line floated in empty space under a short list, and a page with no list had nowhere to put it. The app already had one shortcut of its own, ⌘/Ctrl B for the sidebar, listed nowhere.

**Options considered:**

- **Where the sheet lives**
  - A sheet per page, its hint in the page footer — the prototype's first form.
  - **One sheet for the app; pages add sections to it — chosen.**
- **Where the way in lives**
  - The top bar. It is crowded on small screens and holds slots for search and notifications (ADR-0050 rule 4).
  - The profile menu. Too deep to discover.
  - **The sidebar footer, above Collapse — chosen,** with the other app-level control.
- **Keyboard rows on every list**
  - Off by default, turned on per list — the first form. It kept keys away from lists that don't need them, but the owner wants them for power users who'd rather use the keyboard than the mouse, and few lists would ever turn them on.
  - **In the kit, on by default, a list opts out — chosen.**
- **Single-key shortcuts and WCAG 2.1.4** (Character Key Shortcuts, Level A): a shortcut made of one printable character that works on the whole page must be turnable off, remappable, or active only on focus.
  - Remap. A settings screen for it is more than the app needs.
  - Active only on focus. It would end `?`, `/` and J/K, which are the point.
  - **One switch that turns them all off — chosen,** in the sheet's footer.
- **A search box in the sheet**, as in the owner's reference: left out while the sheet is a page of rows.

**Decision:**

1. **One sheet.** `?` opens it on any page, except while typing in a field or with another dialog or menu open, and `?` closes it again, as Esc does; so does a "Shortcuts ?" row in the sidebar footer, above Collapse. On the icon rail the row is the keyboard icon with a tooltip. Touch screens don't show the row.
2. **Sections.** "Everywhere" comes first (`?`, and ⌘ B or Ctrl B by platform for the sidebar), then the sections the current page registers while it is mounted. A page with no shortcuts of its own shows "Everywhere" alone. Each section has a title and an icon; each row is the action in words and its keys as caps on the right, Backspace drawn as its glyph.
3. **The sheet opens on its title**, without a focus ring on its close button.
4. **Keyboard rows** are a list-kit option, on by default; a list opts out with `enabled: false`. A list with them registers its sections ("On the {plural} list", "On a row"), and its row menus show each action's key. The keys act on the marked row, else the row under the pointer, and never while typing or with another layer open. Delete opens its confirmation; one key never deletes. `/` focuses the search on every list, so the sheet lists it under "On the {plural} list" even where keyboard rows are off, and once where they are on.
5. **A switch for single-key shortcuts** (WCAG 2.1.4). `?`, `/`, J/K and a row's action keys are single characters that listen on the whole page, so speech input can fire them by accident, and 2.1.4 requires a way to turn them off. The sheet's footer has a "Single-key shortcuts" switch: on by default, remembered in the browser (`localStorage`). Off, every one of those does nothing and the sheet says so ("Off" in place of their keys; the rows stay listed). ⌘/Ctrl B, the arrows, Enter and Esc are not character keys and keep working. The sheet stays reachable from the sidebar's Shortcuts row. The row action keys are gated as one set, Backspace included: it isn't a character key, but one rule is easier to state and to trust than two.

Built by the list-kit revision ticket, and revised by #398. Divisions has keyboard rows on; Roles and Users get them when they move to the kit.

**Trade-offs:**

- **A registry the pages talk to.** Pages register sections instead of owning a sheet, a small piece of shared state. It keeps the way in and the look in one place, and a page that adds no shortcuts costs nothing.
- **A sidebar row on every page.** A permanent row for a feature many users never touch. It is one quiet row, hidden on touch screens, and it is the only place a user without the habit of pressing `?` would find shortcuts.
- **On by default.** Every kit list gets keys, including master data where they pay off less, and a user who never wanted them meets `?`, `/` and letter keys they didn't ask for. They only act outside fields and layers, and the switch is one tap away in the sheet.
- **One switch, not one per key.** A user who wants `/` but not `E` can't have that. Per-key settings are a settings screen the app doesn't have.
- **A browser-only setting.** It doesn't follow the user to another browser. That keeps it out of the API and the database, and a missing value means on.
