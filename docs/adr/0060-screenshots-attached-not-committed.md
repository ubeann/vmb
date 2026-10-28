# ADR-0060: Screenshots are attached to the issue or PR, not committed

**Context:** Before this decision, `scripts/upload-asset.sh` stored every screenshot as its own commit in the private `ubeann/vmb-assets` repository through the Contents API, and printed a link that only collaborators could open. ADR-0057 relied on that privacy when it made `vmb` public.

From 12 to 18 October 2026, `vmb-agent` made 263 of those commits. On 18 October it made 77, and 59 of them landed in one hour, about four seconds apart; the account's profile showed 170 contributions that day. GitHub's abuse detection suspended the account that evening (ADR-0059). It was the most bot-like burst the account ever made, and the likeliest trigger.

GitHub CLI 2.99 (September 2026) added `--attach` to `gh issue create|edit|comment` and `gh pr create|edit|comment`. It uploads images and video to GitHub's attachment storage, the same storage as dragging a file into a comment, and writes the link into the body. It makes no commit. Attachments have the repository's visibility: on a public repository "uploaded files can be accessed without authentication". There is no way to list or delete them.

At the time of this decision, `vmb-assets` held 456 files. 395 were linked from 58 places: 36 PR bodies, 20 issue bodies and 2 comments. 32 were written by `ubeann` and 26 by `vmb-agent`.

**Options considered:**

- **Batch the private repository.** Keep `vmb-assets`, but one commit per round instead of one per file. Screenshots stay private, but every round still adds a commit, and outsiders still see broken images.
- **Build an evidence tool first** (clipon, in the owner's `smidgedotdev` org). Rejected for now: its first version wraps `--attach` anyway, and VMB should not wait for a new Rust project.
- **Attach, and move the old links over.** Chosen. Preview screenshots only ever show seeded fixtures (ADR-0019, ADR-0029), so public is acceptable once each image has been looked at.

**Decision:**

- **New images.** They go on the issue or PR with `--attach`, all of a round's files in one command (`docs/agents/issue-tracker.md`, Images). A file `--attach` refuses, such as a text report, goes inline in a `<details>` block. `scripts/upload-asset.sh` becomes a stub that refuses to run.
- **Reviewing the old images.** All 395 linked files were reviewed before anything was published. A model read every image, and the four composites wider than 19,000 px were read in 3,000 px tiles. None showed a secret, a real person outside the seed, legacy data or private browser context. Three were judged borderline and left to the owner, who published the terminal screenshot (local paths and a `.env` file name, no values) as it was and had the two third-party design references (setproduct.com and Untitled UI) described in words instead of republished. The prototype's 239 "department · city" divisions are generated in code (commit e882d0f), not legacy data.
- **Moving the links.** Each of the 58 items was re-edited by its own author's token, with its files attached in one command, at most 12 items an hour per account. Text files were inlined. A dry run came first, and each item was verified afterwards. The two old comments could not be edited by `gh`, so their content was posted again as new comments and the old ones now point there. The move finished on 2026-10-28 with no `vmb-assets` link left in `vmb`.
- **Retiring `vmb-assets`.** It is archived once nothing in `vmb` links to it, and deleted after two weeks without a broken link.

**Trade-offs:**

- Every screenshot is public and permanent, so the look-before-attach rule is the only privacy control left. A careless capture cannot be withdrawn.
- Files `--attach` does not take (text, JSON, Markdown) lose their links and live inline instead.
- The migration edits 58 items, slowly, on two accounts. It is the last bulk write this repository plans.
