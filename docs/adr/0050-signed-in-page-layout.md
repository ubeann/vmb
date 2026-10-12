# ADR-0050: Signed-in page layout — width sizes, the list column rule, and the top bar's slots

**Context:** The Divisions list (#301, PR #340) was the first page on the list kit. Viewed by the owner on a 2K screen, it showed the body of every signed-in page has no width contract:

- The white panel (ADR-0036's 2026-10-08 amendment) spans everything right of the sidebar, and the page body spans the panel. The legacy `main { max-width: 64rem }` rule in `app.css` is cancelled with `max-w-none`, and nothing replaces it.
- The table is full width and the browser shares the spare width across every column. "Finance" sat about 1,600px from its Actions menu, and Code, Status and Updated took hundreds of pixels each for values of about eight characters.
- The page title and its primary action sat at opposite edges of the screen.
- The top bar held only the sidebar toggle and the profile menu, an empty strip on a wide screen. Search (#282) and notifications (#283) are planned for it, but their places were undecided.
- No review viewport is wider than 1920px (`design-workflow.md`), so nothing in the process looked at this size.

The decisions came from a grilling session with the owner on 2026-10-08. 4K monitors mostly run at 150–200% scaling, so the widths to design for are about 1920–2560 CSS pixels.

**Options considered:**

- **Where the cap applies**
  - Cap the content inside the white panel and centre it; the panel stays full width — chosen.
  - Cap the panel itself, so the warm frame shows on both sides. The frame would change shape from page to page.
  - Left-align capped content. That leaves one wide blank strip on the right, which is the same problem moved.
- **How many widths**
  - Three sizes chosen per page — chosen.
  - One width for every page. Forms read badly at list width, and later wide tables (stock ledgers, trip logs) need no cap.
- **Columns**
  - Utility columns fit their content; identity and free text take the rest — chosen.
  - The table at its natural width. It looks unfinished under a full-width toolbar.
- **Breadcrumb labels**
  - From `$lib/nav.ts`, plus the record's name from page data — chosen.
  - A new entity registry (label, plural, icon, route, permission). Breadcrumbs alone don't justify it; it can grow out of `nav.ts` when search (#282) needs more than `nav.ts` holds.
- **A dropdown switcher in the trail**
  - None now — chosen.
  - A record switcher ("Finance ▾"). With #302's modal the trail stays on the list, so the record crumb shows only on full pages, and search covers jumping to a record across every entity.
  - A sibling switcher ("Divisions ▾"). It repeats the sidebar.
  - A Division context switcher. The only one with a job, and only once data is scoped by Division; that is a domain question, researched in #350.

**Decision:**

1. **Page widths.** Every signed-in page wraps its body in `Page` (`$lib/components`) and picks a `width`:
   - `narrow`, about 48rem: forms and detail pages.
   - `default`, 90rem: lists.
   - `full`, uncapped: tables wider than the default.

   The content is capped inside the white panel and centred in it; the panel stays full width. The owner confirmed 90rem from screenshots at 80, 90, 96rem and uncapped, at 1440, 1920 and 2560 wide, in #348. A per-user choice of width is a setting for #347, not a toggle on a page.

2. **Page header.** `PageHeader` (named in ADR-0035 rule 2) holds the title, the description and the one primary action, at the content's edges, not the window's.
3. **The list column rule.** In a list-kit table, utility columns (codes, status, dates, actions) shrink to their content (`w-px whitespace-nowrap`). The identity column and free-text columns share the rest; free text is capped at about 48ch and truncated, with its full text in `title`. A page states which kind each column is, through the list kit, instead of tuning widths by hand. ADR-0035 rule 5 still holds: the table scrolls horizontally inside its frame on narrow screens.
4. **The top bar's slots**, left to right:

   `sidebar toggle · [Division context switcher, if #350 adopts one] · breadcrumb ········ search (#282) · notifications (#283) · profile`

   Slots for features that aren't built get no placeholder UI.

5. **Breadcrumbs.**
   - The group and item labels come from `NAV_GROUPS` in `$lib/nav.ts`; a record's crumb comes from its page's data.
   - A group with no page of its own ("Master") is plain text. The last crumb is the current page, marked `aria-current="page"` and not a link.
   - While a record is open in a modal over a list (#302), the trail stays on the list, the page underneath.
   - The item crumb shows its `nav.ts` icon, the one the sidebar highlights. A record crumb shows the record's own identity: a Division's coloured icon tile, a User's avatar. Groups have no icon. Icons are `size-4`, muted and `aria-hidden`.
   - Crumbs are plain links, with no dropdowns.
   - Below `md`, only the current section's name shows, truncated.
6. **A 2560×1440 review viewport** joins the list in `design-workflow.md`.

Built by #348 (rules 1–3 and 6) and #349 (rules 4 and 5). How a record opens on wide screens beyond #302's modal, and other per-user appearance settings, are #347.

**Trade-offs:**

- **Unused width on very wide screens.** At 2560px a `default` page leaves wide margins in the panel. That's the price of rows that read in one sweep, and `full` is there for a table that earns the room. A side pane that puts the space to work is #347's question, not a reason to stretch lists now.
- **A wrapper on every page.** Each page states its width instead of inheriting one. One component and one prop is cheap next to fixing width per page later, and it replaces the legacy `main` rule that `AppShell` had to cancel.
- **Breadcrumbs depend on `nav.ts`.** A screen not in the menu needs its trail supplied by its page. That's acceptable while every screen lives under a menu item, and it avoids a registry with one consumer.
- **No switcher yet.** The trail's first slot is reserved for a context switcher that may never come. Recording the slot costs nothing; building it before the domain needs it would mean guessing what it switches.

**Amendment (2026-10-11): the header, the column rule, and room on tablets.** The list-kit prototype ([ADR-0051](0051-list-kit-interaction-rules.md)) changed three things here.

- **Rule 2, the page header.** The title is the display face at `text-2xl`, and the one primary action shares its row. The description is one sentence of about 60ch at most, under them at full width (ADR-0051 rule 1). `PageHeader` holds the three as before.
- **Rule 3, the list column rule.** Utility columns still shrink to their content. Free text no longer stops at 48ch: it takes the spare width and truncates, down to about 16ch (`w-full max-w-0 min-w-[16ch]`), so a 1024px screen fits the table without a sideways scroll. The rule now reads the card's width, through container queries:
  - under 42rem, free text folds and rides under the identity as a second line;
  - under 32rem, rows fold to two lines, the identity over the utility values ("CBK · Updated 5 Jan 2026"), and the header row goes.

  The kit has a kind per column for this: `utility` stays (actions), `meta` (codes, dates) shrinks to its content and folds into the second line under 32rem, `text` is the free text above, `identity` takes the spare width once the free text folds, down to 20ch (`@max-2xl/list:w-full @max-2xl/list:max-w-0 @max-2xl/list:min-w-[20ch]`), and the whole card once rows fold. `ListCard` is the one `@container/list`; View learns the fold from the same 32rem line, so the header row, the rows and View's Sort by never disagree.

  The second line carries what folded, the most useful first. In the list kit this replaces ADR-0035 rule 5's horizontal scroll, which stays for tables outside the kit.

- **Room on tablets (new).** Between 640 and 1023px, the page padding is 16px instead of 24px, and the sidebar starts as its icon rail. The rail is the default, not an override: a user's saved choice (the sidebar cookie) still wins. The server can't know the width, so it renders the sidebar open and flags it; a media query in `app.css` paints the flagged one as the rail from the first frame (no pre-paint script), and mounting takes the real state without a visible change. At 768px the list card grows from 456 to 656px, enough for a real table instead of two-line rows.
