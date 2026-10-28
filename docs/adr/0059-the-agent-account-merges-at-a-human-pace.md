# ADR-0059: The agent account keeps a human pace

**Context:** GitHub's abuse detection suspended `vmb-agent` at about 17:10 UTC on 2026-10-18 and gave no reason. The account was six days old, and the repository had been made public that afternoon (ADR-0057). That day the account:

- made 77 screenshot commits to `vmb-assets`, 59 of them in one hour, about four seconds apart (ADR-0060);
- merged 19 PRs, against 4 to 7 a day before;
- posted templated `@coderabbitai review` and `@sourcery-ai review` comments on nearly every PR (ADR-0058).

While the account was suspended, everything it had authored was hidden, even from the owner: 96 issues and PRs, #408 to #509, and its comments. Every flow that uses `gh` stopped: builds, merges, the dispatcher and the digest.

Support reinstated it on 2026-10-27 (ticket #4873962) with "Sometimes our abuse detecting systems highlight accounts that need to be manually reviewed", and still named no reason. In the reinstatement request the owner promised four things: a profile that says it is a machine account, a cap and a gap on merges, fewer bot-tagging comments, and no API polling.

**Options considered:**

- **Fix only the screenshot burst.** It is the likeliest trigger, and ADR-0060 removes it. But the reason was never confirmed, and the owner told Support the merge limits would stand.
- **Spread the load over a second account.** Rejected: the Terms of Service allow one free machine account per person, and "you may not share API tokens to exceed GitHub's rate limitations". Rate limits were never hit anyway; the flag came from the pattern of writes.
- **Move agent writes to another forge** (GitCafe two-way sync). Rejected: its docs do not say which GitHub identity its sync writes as, and if it writes as `vmb-agent`, GitHub sees the same pattern.
- **A loose cap in the one merge path.** Chosen. `scripts/merge.sh` already runs for every merge (ADR-0058), so a check there covers night builds, daytime threads and owner-approved merges alike. The limits sit above a normal day, so they only stop a runaway.

**Decision:**

- **The limits.** `scripts/pace.sh` allows `vmb-agent` at most 12 merges a WIB calendar day, at least 15 minutes apart. It reads them with one GitHub search, and `PACE_DAILY_CAP` and `PACE_GAP_MINUTES` override the numbers.
- **On a wait.** `scripts/merge.sh` asks `pace.sh` after the gate and before any write. When the pace says wait, it labels the PR `merge-paced`, posts no comment and exits 3, and the build ends in the new **Paced** end state.
- **The dispatcher and digest.** The dispatcher first merges the PRs labelled `merge-paced`, and launches nothing once the day's cap is reached. The morning digest lists paced PRs and the day's pace.
- **Loosening with age.** The limits are sized for a young account that has been flagged once. They are far below GitHub's documented secondary rate limits (80 content-creating requests a minute, 500 an hour), which were never hit; the flag came from abuse detection, which reads patterns, not counts. After three clean months, on 2027-01-27, the owner reviews them: raise the cap and shorten the gap in steps, through `PACE_DAILY_CAP` and `PACE_GAP_MINUTES` first and the defaults once a step holds, or remove them if the account's history makes them pointless.
- **The other promises.** The profile says `vmb-agent (bot)`, "Machine account run by @ubeann". Screenshots are attached, one command per round (ADR-0060). The polling-blocking hook from ADR-0058 stays.

**Trade-offs:**

- A day above 12 agent merges waits until the next day, but no day before the suspension reached 12.
- A paced PR whose head moves before the dispatcher's next run fails the gate again and goes to the owner.
- Bot-tagging comments are not reduced here. CodeRabbit reviews a public repository with fewer than 10 stars only when asked by comment, and moving Sourcery from a comment to a label needs a dashboard change that has to be tested first. Until then the cap bounds those comments too: at most two per merged PR.
