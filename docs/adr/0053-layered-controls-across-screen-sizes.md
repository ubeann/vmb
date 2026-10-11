# ADR-0053: Layered controls across screen sizes — panel, dialog or sheet; steps; handovers; reopening fresh

**Context:** The list kit's Filter panel ([ADR-0051](0051-list-kit-interaction-rules.md) rule 4) has steps: a date filter opens presets, and a custom range opens a calendar. On desktop the calendar opens beside the panel. On a phone there is no "beside", and on a tablet there isn't room. Testing the prototype across sizes turned up a run of failures that a single breakpoint couldn't fix:

- a phone sheet floating over a desktop table after the window was widened;
- the side picker pushed off the left edge when a window narrowed;
- the panel's left edge jumping 32px when a date step opened inside it;
- a panel closed mid-step that reopened mid-step, at another size, behind a picker that no longer fitted;
- the page squeezed to 159px wide after a DevTools device preset, because the phone sheet opened while the window still reported the panel's old width, and its scroll lock padded the page by the difference.

The same layers will hold the record modal (#302) and later pickers, so the rules are recorded once.

**Options considered:**

- **The frame by screen width**
  - A bottom sheet on every touch screen. On an open foldable it hangs off the bottom of a 623px-wide screen, narrower than the screen, which looks stranded.
  - **A bottom sheet under 480px, a centred dialog from 480 to 639px, the panel from 640px — chosen.** Android's guidance draws the same line between compact and medium screens.
- **Where a step opens**
  - Always inside the layer. The desktop panel would grow and shrink with each step.
  - **Beside the panel where there is room, inside it where there isn't — chosen.** The room is measured, not guessed from a breakpoint, because the sidebar changes it.
- **The panel's width**
  - Wide enough for the calendar step everywhere (22rem). Too wide on desktop, where the steps never open inside.
  - **20rem where the picker fits beside it, 22rem from the start where it doesn't — chosen.**
- **Reopening a closed layer:** where it was left, or **fresh — chosen.**

**Decision:**

1. **The frame.** Under 480px a layer is a bottom sheet (up to 26rem wide, centred on wider screens). From 480 to 639px it is a centred dialog, rounded all round, at most 85% of the screen tall. From 640px it is the panel by its button. Only the frame changes: the content and steps are the same in each.
2. **Steps.**
   - In a sheet or dialog, a step replaces the content, with a back arrow and its own title.
   - On the panel, a step opens beside it when the 560px picker fits to its left, and inside it when it doesn't.
   - A custom range is its own step, so no step scrolls on a 375×667 screen. Its days are 44px, up to 48px where the sheet is wider and the screen taller than 700px.
   - The 44–48px days are for the sheet and for a step inside the panel. The picker beside the panel, where there is room for it (1366px and up), keeps 40px days: its pointer is fine there, WCAG 2.5.8's 24px minimum holds, and 44px would widen it by about 48px and push the room line out. No touch-pointer change (owner decision on #376).
3. **One size per layer.** A layer keeps its width through its steps. The panel opens at 20rem where its picker fits beside it and at 22rem where the steps will open inside; a sheet is the screen's width up to 26rem. A layer with no steps and less to show may name a narrower panel: View is 16rem (`panelClass`, #397).
4. **Main actions name the result and fill the footer.** "Show 12 divisions" closes the filters; "Apply 2 – 5 Jan" applies a range, "Pick a start and an end" until both days are picked. The action carries the icon of what it confirms only once it can be pressed. Where a footer has no room for the date, the label shortens and the full text is its `title`. A layer whose picks apply at once and can't change the count ends with Done. An action that only closes a layer ("Show 12 divisions", Done) appears in the sheet and dialog, not the panel: on the panel a click outside, Esc or the layer's button closes it, and the footer would add a second primary green under the page's own. An action that applies something ("Apply 2 – 5 Jan") appears in every frame. Other buttons are at least 80px wide.
5. **Focus.** A step puts focus on its title, quietly; the picker opens on the selected day, or today. Neither rings the first control.
6. **Handovers.** A layer follows the screen across the lines in rules 1 and 2: the panel becomes the sheet and back, a step inside the panel moves out beside it and back. A half-picked range is kept, and nothing is applied on the way. A handover waits until the window has stopped resizing (200ms), and a sheet opened by a handover waits until the window and the page agree on the width (a scrollbar's 20px apart, 1s at most).
7. **Closing resets.** A layer the user closes (a click outside, Esc, ×, its button) forgets its step, its picker and any half-picked range, and opens next time at its top level. A handover is not a closing. Applied filters live in the URL, so nothing real is lost. A click or tap outside is only a closing: it is not passed on to what lies beneath, so a click on a list row to close the panel doesn't also open the row. On the panel the layer swallows that click itself and closes from it, mouse and touch alike; in the sheet and dialog the overlay does it. Another layer's button is the exception, so Filter hands over to View in one click.

Built by the list-kit revision ticket, as the kit's layer component; #302's record modal uses rules 1, 5 and 7.

**Trade-offs:**

- **Three frames to test.** Sheet, dialog and panel each need checking, at the 480 and 640 lines and between. The content is shared, so the cost is the frames and the handovers, not three copies of the filters.
- **Measuring room at run time.** Rules 2 and 3 read the panel's position instead of a breakpoint, which is harder to reason about from the CSS alone. A breakpoint was wrong by the sidebar's width at the same screen size.
- **Waiting before a handover.** For 200ms after a resize the old layer stays. A drag across 640px hands over once instead of flickering, and the squeeze in the context can't happen.
- **Closing loses a half-picked range.** Someone who closes the panel by accident picks the days again. Reopening mid-step at another screen size was the worse failure.
