# ADR-0051: List kit interaction rules — the toolbar, filters, views, rows and paging

**Context:** The Divisions list (#301, PR #340) was the first page on the list kit, and Roles (#303), Users (#304) and the next master lists (#305) were about to copy it. A critique of #340 with the owner on 2026-10-09 found the kit reading as a set of parts rather than one control: the Status column repeated "Active" on almost every row, the views (All and Trash) sat in their own strip apart from the toolbar, each filter was a separate button, the `Actions` button took a column of words, the paging control showed on a list that fitted on one page, and nothing changed below the desktop width except a sideways scroll.

The questions were settled in a grilling session (Q1–Q22) and then in about 50 rounds on a throwaway prototype route, `/prototype/list-kit`, over the seeded Divisions plus a 239-row set (`?data=many`). Each round put variants side by side at 1440, 1024, 768, 623 and 390 pixels, in light and dark; the owner picked one, and the prototype commit records the pick. The branch is `t3/improve-table-filter-header-ui`; the final variant is `C3kd2`. It never merges: it bypasses the sign-in gate in dev.

Two neighbouring decisions have their own records: the app-wide shortcut sheet ([ADR-0052](0052-app-wide-keyboard-shortcuts.md)) and how layered controls (panels, sheets, dialogs, side pickers) behave across screen sizes ([ADR-0053](0053-layered-controls-across-screen-sizes.md)). The page header and the column rule amend [ADR-0050](0050-signed-in-page-layout.md); the control skin and corners amend [ADR-0035](0035-tailwind-and-shadcn-svelte-design-system.md).

**Options considered:**

- **The toolbar** (round 2, compared at 1440 and 1024)
  - One row: views, search, a button per filter, "More filters" past the second — the grilling's first answer (Q5, Q6). With two filters set it wrapped at 1440.
  - A Filter menu, the filters in use on a second row.
  - **Inside the card: the views as tabs on the table's top edge, search, Filter and View beside them, the filters in use on a strip below — chosen.** It never wraps at 1024, and the controls and the table read as one object.
  - Add-filter pills, always two rows.
- **The filter control** (rounds 3–7)
  - A menu with a submenu per filter. Three layers to reach an option, and the submenu covered the search.
  - One menu with radio sections. Not enough for multi-value filters (Q12) or a date range.
  - **One panel with a section per filter — chosen:** checkboxes with counts for values, presets plus a range calendar for dates.
  - A side sheet with Apply. Heavy for one to three filters.
- **The date range** (rounds 5–7)
  - A range calendar inside the panel. It stretched the panel by 300px, and two open at once ran off the screen.
  - **A row per date filter that opens a picker beside the panel — chosen.** The panel stays short whatever is picked; the cost is one extra click per preset.
- **Sorting on a phone** (rounds 20, 21, 28, 29)
  - The header row with only "Name ↑" left. It sorts by name and nothing else.
  - A "Sort: Name, A–Z" menu in place of the header.
  - **Sort inside the View panel, as two check lists (Sort by, Order) — chosen.** View already holds rows per page; the header row goes, for one more row of data.
  - Two rows of buttons. Compact, but "Last updated → Newest first" reads better as words.
- **An inactive row on a phone** (rounds 26, 27)
  - The pill moved to the second line, or the word alone, or the word with a dot.
  - **The word, and the row dimmed where the pill doesn't fit — chosen.** On desktop the grey pill alone; a dimmed tile there would say it twice.
- **The spare width once Description folds** (round 24)
  - The name column takes it, which leaves Code and Updated against the row menu.
  - The Updated column takes it. Dense, and the related values sit together.
  - **The description rides under the name as a second line — chosen.** Nothing is lost.
- **The page description** (Q8, round 51)
  - None; the concept is explained in the empty state (Q8). An empty state rarely shows once a list has data.
  - **One sentence under the title — chosen.**

**Decision:** The rules below are the list kit's contract. Divisions shows them; Roles, Users and every later list inherits them through the kit, not by copying the page.

1. **Header.** A display-face title at `text-2xl` and the one primary action share a row. Under them, one muted sentence of about 60ch at most says what the record is and why it matters: no second sentence of detail, no links. It wraps to two lines on a phone, at full width under the title and action.
2. **The card.** The list is one card. Its top edge holds the views as tabs (All, Trash) with their counts, then search, Filter and View. The counts follow the search and filters, so a tab reads what it would show ("All 12 · Trash 0"). When the toolbar wraps, a hairline runs under the tabs.
3. **Search.** The placeholder names the fields the query matches ("Search name, code or description"), and shortens to "Search {plural}" when the field would cut it off. One slot on the right: the `/` hint while the field is empty and unfocused, the kit's own × once there is text (the browser's cancel button is hidden). While a search is pending the magnifier becomes a spinner and the field is `aria-busy`. Esc clears the text, then leaves the field. The matched text is marked in the name, code and description, so a row shows why it is listed.
4. **The Filter panel.** One panel, a section per filter.
   - **Value filters** are checkboxes. None ticked means any; several are one comma-separated parameter (`status=active,inactive`, Q12). Each option shows how many rows it would give, counting the search, the other filters and the current view.
   - **Date filters** are presets (Any time, Today, Last 7 days, This month) with their dates shown, and a custom range. A custom range that equals a preset is saved as the preset. Date presets carry no counts: they overlap, so the numbers barely differ.
   - A choice applies at once and the panel stays open; Reset clears the filters and keeps the search. How the panel, its date picker and its phone form behave across screen sizes is ADR-0053.
5. **Filters in use** show as chips on a strip inside the card, under the toolbar. The search is a chip too. A chip is the filter's icon, its name and its value on a light green tint, opening the panel when clicked, with × to drop it. "Clear all" is a quiet button right after the last chip, and it clears the search with the filters. "n of m {plural}" moves to the footer.
6. **The View panel** holds the columns (the identity column listed but locked, "Always shown"), rows per page (10, 25, 50, 100; 25 by default) and, once rows fold to two lines, Sort by and Order in place of the columns. A dot on its button means something differs from the default, and Reset puts every part back.
7. **Rows.**
   - A click anywhere on a row opens the record (Q2); the name stays a real link, for a new tab or no JavaScript.
   - A Division's icon is a tinted tile: its colour at about 14% behind the glyph in the colour itself.
   - The hover colour lands on every cell in the same frame, pinned cells included; a row whose menu is open keeps the hover colour.
   - An inactive record shows the grey "Inactive" pill after its name where the pill fits; where rows fold to two lines, the pill goes, the tile greys and the name mutes, and "Inactive" leads the second line. The word is always there (ADR-0035 rule 5). There is no Status column (Q1).
8. **Row actions.**
   - A row gets a ⋮ menu only for two or more actions; one action is a button in the row. The Trash's only action, Restore, is a button.
   - Menu items carry an icon (muted, except the destructive item) and, on lists with keyboard rows (ADR-0052), their key.
   - A row action lifts on hover to the page colour with a hairline, so it stands out from the hovered row.
   - Delete always asks first.
9. **The Trash.** Deleted records stay in the Trash for the audit trail; there is no permanent delete. The Trash says so in one line ("Deleted divisions stay here for the audit trail. Restore one to use it again."), counts "n deleted {plural}", and has its own empty state. Records with no Trash (the glossary's Trashed) are unaffected.
10. **Paging.** The paging control hides when every row fits on one page (Q10). From 640px it is numbered with gaps (‹ 1 … 4 **5** 6 … 10 ›). Under 640px it is "‹ Previous · Page 5 of 10 · Next ›" under a centred count, both buttons the same width so the label sits in the middle.
11. **The card answers to its own width** (container queries), not the window's, because the sidebar changes the card's width at the same screen size.
    - Under 42rem of card, the free-text column folds and its value rides under the name as a second line; Filter and View become icon buttons, their count and dot moving to a corner.
    - Under 32rem, rows fold to two lines, the name over "code · updated", the header row goes, and sorting moves into View (rule 6).
    - The control sizes, skin and corners are ADR-0035's amendment; the column rule is ADR-0050's.

Built by the list-kit revision ticket, which blocks #303, #304 and #305; #302 (the record modal) goes ahead alongside it.

**Trade-offs:**

- **More moving parts than #340.** A panel with checkboxes, counts, presets and a picker is more code than a row of filter buttons. Each part was asked for by a real case: multi-value Role on Users (#304), dates on every list, a phone that can't fit four buttons.
- **The counts cost a query each.** An option's count is a filtered count per option. Cheap on master data; a long list may need the counts to be estimated or dropped, which the kit allows per filter.
- **No permanent delete.** The Trash grows. The audit trail is worth more than the space, and purging, if it is ever needed, is an admin job, not a list action.
- **Container queries over breakpoints.** Every rule reads the card's width, which is less familiar than screen breakpoints but right where the sidebar takes a varying share of the screen.
- **Supersedes parts of the grilling.** The toolbar (Q5, Q6), the page description (Q8) and the Trash menu of one (Q16) came out differently once seen; the prototype commits record each change.
