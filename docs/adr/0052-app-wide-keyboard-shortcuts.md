# ADR-0052: App-wide keyboard shortcuts — one sheet, page sections, and keyboard rows off by default

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
  - On for every list.
  - **In the kit, off by default, turned on per list — chosen.** They pay off on lists people work through all day (orders, shipments, later), much less on master data.
- **A search box in the sheet**, as in the owner's reference: left out while the sheet is a page of rows.

**Decision:**

1. **One sheet.** `?` opens it on any page, except while typing in a field or with a dialog or menu open; so does a "Shortcuts ?" row in the sidebar footer, above Collapse. On the icon rail the row is the keyboard icon with a tooltip. Touch screens don't show the row.
2. **Sections.** "Everywhere" comes first (`?`, and ⌘ B or Ctrl B by platform for the sidebar), then the sections the current page registers while it is mounted. A page with no shortcuts of its own shows "Everywhere" alone. Each section has a title and an icon; each row is the action in words and its keys as caps on the right, Backspace drawn as its glyph.
3. **The sheet opens on its title**, without a focus ring on its close button.
4. **Keyboard rows** are a list-kit option, off by default. A list that turns them on registers its sections ("On the {plural} list", "On a row"), and its row menus show each action's key. The keys act on the marked row, else the row under the pointer, and never while typing or with another layer open. Delete opens its confirmation; one key never deletes.

Built by the list-kit revision ticket. Which lists turn keyboard rows on is decided per list; Divisions, Roles and Users ship with them off.

**Trade-offs:**

- **A registry the pages talk to.** Pages register sections instead of owning a sheet, a small piece of shared state. It keeps the way in and the look in one place, and a page that adds no shortcuts costs nothing.
- **A sidebar row on every page.** A permanent row for a feature many users never touch. It is one quiet row, hidden on touch screens, and it is the only place a user without the habit of pressing `?` would find shortcuts.
- **Off by default.** Lists that would benefit lose the shortcuts until someone turns them on. Turning on is one option; taking away keys people have learned is harder.
