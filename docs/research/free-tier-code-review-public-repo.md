# Free-tier AI code review for a public, proprietary-licence repo

Researched on 2026-10-18. Question: now that `ubeann/vmb` is public (PR #479) under the proprietary "VMB Source License" (GitHub reports `NOASSERTION`), which AI code-review tools give a free tier the repo actually qualifies for, what are the limits, how is each installed and configured, and how would each fit the Claude-only review flow in `docs/agents/model-routing.md` without waking build threads the way Macroscope's automatic summaries did?

Repo facts checked live with `gh api repos/ubeann/vmb` on 2026-10-18: `visibility: public`, `owner.type: User` (personal account, not an organisation), `stargazers_count: 0`, `license.spdx_id: NOASSERTION`. PRs are opened by the collaborator bot account `vmb-agent`, as drafts, and `scripts/` promotes them when the gate passes.

Every quotation below was returned by the fetch tool as page text; where the fetch only paraphrased, the claim is marked as such. Claims resting on anything other than the vendor's own pages are marked **unverified**.

## Executive summary

**The licence question splits the field cleanly.** Three vendors gate their free tier on an OSI-approved licence and/or non-commercial status, and this repo fails all three on its face: **Greptile** ("qualified non-commercial projects with an OSI-approved license", plus 50 stars), **Graphite's Diamond-for-OSS programme** ("Must be licensed under an OSI-approved open-source license" and "exclusively for non-commercial open-source projects"), and **SonarQube Cloud's OSS plan** ("Public, OSI-licensed repos"). Everything else that has a free tier gates only on the repository being **public**, which this repo is:

| Qualifies on "public" alone                                          | Wording                                                                                                                                |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **CodeRabbit** Open Source plan                                      | "Unlimited public repositories, no credit card required" / "receive free reviews forever for public repositories"                      |
| **Sourcery** Open Source plan                                        | "Free" for "Public repositories"; "Install Sourcery on your public repositories on GitHub or GitLab"                                   |
| **Codacy** Open Source plan                                          | "keep scanning your public repositories for free on the Open Source plan"                                                              |
| **Semgrep** Free Edition                                             | "Public repositories: unlimited"; the 10-contributor cap counts commits to _private_ repos only                                        |
| **GitHub** CodeQL, secret scanning, push protection, Actions minutes | "Available for public repositories by default"; Actions "free ... for public repositories that use standard GitHub-hosted runners"     |
| **Qodo** (hosted)                                                    | "completely free for public open-source repositories" (blog, 2025-10-16) — **the word "open-source" is undefined; treat as uncertain** |
| **Korbit**                                                           | "Korbit Max is free for all open source repositories!" (homepage) — **"open source" undefined; product status uncertain**              |

Three catches that matter more than the licence:

1. **CodeRabbit will not review automatically here.** "For public repositories with less than 10 stars, CodeRabbit requires reviews to be triggered manually." At 0 stars every review needs a `@coderabbitai review` (or `full review`) comment. That is actually a good fit for a repo that wants review-on-request, not review-on-every-push.
2. **Sourcery is the only free tier found that reviews every PR automatically with a published, licence-free quota** (250,000 diff characters per developer per rolling 7 days; 150,000 per PR), skips drafts by default, and has a per-repo "post nothing" switch plus independent toggles for summary, guide and diagrams. It is the lowest-friction "independent-model bug hunter on every PR".
3. **Macroscope has no open-source or public-repo tier.** Its only free allowance is "$100 in free usage" for new workspaces and "1,000 free Agent credits per month" for CLI/agent use; GitHub PR reviews bill per KB from the balance. Nothing changes for Macroscope because the repo went public.

**Recommendation (details in "Recommended setup"):** turn on the GitHub-native free security features (CodeQL default setup; secret scanning and push protection are already on by default for public repos); install **Sourcery** as the automatic independent reviewer with the quiet profile and summaries off; install **CodeRabbit** as a second, on-request opinion that the merge gate triggers with a comment once a PR is promoted from draft; keep **Macroscope** exactly as it is (manual, `complex` only). Skip Copilot code review unless the owner already pays for Copilot Pro (the review itself is not on Copilot Free, and the repo-level automatic review only covers PRs "created by people with access to Copilot", which `vmb-agent` is not). Do not apply to Greptile, Graphite Diamond or SonarQube OSS — the licence rules them out and applying would mean misrepresenting the project.

## Per-tool findings

### 1. CodeRabbit — qualifies (public), manual trigger only at < 10 stars

**Eligibility wording.** Plans page: the Open Source plan is "Unlimited public repositories, no credit card required." and "Open-source projects receive Team features with no paid subscription required." Pricing FAQ: "Sign up for CodeRabbit using GitHub or GitLab, install CodeRabbit on a public repository, and receive free reviews forever for public repositories." No OSI or non-commercial condition appears on either page. The GitHub Marketplace listing says "Public repositories are free to use with CodeRabbit." but labels the free tier "Open Source Advanced plan is free for Open Source projects." — the docs say Team features, the listing says Advanced; the docs are the more specific source.

**What you get.** Team-tier features (the docs list Triage, Change Stack AI chat, CI fixer, issue planning, unit-test generation, merge-conflict resolution on top of review). The docs do not say the Advanced tier's continuous security review is included.

**Limits (the OSS row of the rate-limit table).** PR reviews per hour: 1–10 per developer, "scoped per repository", and "OSS PR review rate limits vary by repository star count." Files per review: 100–300 ("vary by project community and popularity"). IDE reviews 1/hour, CLI reviews 3/hour, chat 25. And the decisive line: **"For public repositories with less than 10 stars, CodeRabbit requires reviews to be triggered manually."** `@coderabbitai rate limit` shows remaining capacity without spending a review. Paid plans: Essentials $24/mo annual ($30 monthly), Team $48 ($60), Advanced $72; 14-day Advanced trial for new organisations (the docs do not say whether that trial applies to an OSS-only account).

**Install.** app.coderabbit.ai/login → "Login with GitHub" → authorise → pick the **personal account** (the docs say to select "your personal account for personal repositories"; you need owner permission on the repo, which `ubeann` has) → choose "Only select repositories" → `vmb` → "Install & Authorize". Permissions requested: read Actions/discussions/members/metadata/merge queues; read-write checks, code, commit statuses, issues, pull requests, workflows (the docs say workflow write is only exercised if an agent edits `.github/workflows/`).

**Draft and comment behaviour.** `reviews.auto_review.drafts` defaults to `false` ("Include draft PRs"). Commands: `@coderabbitai review` (incremental), `@coderabbitai full review`, `pause`, `resume`, `@coderabbitai ignore` in the PR body, `resolve`, `summary`, `configuration`, `help`. The docs do not say who may post the trigger comment; whether a comment from `vmb-agent` counts is **unverified** — test it once.

**Noise controls (`.coderabbit.yaml`, defaults in brackets).** `reviews.profile` [`chill`; also `quiet` "for only the most important feedback", `assertive` "may feel nitpicky"]; `reviews.high_level_summary` [`true`]; `reviews.poem` [`false`]; `reviews.sequence_diagrams` [`true`]; `reviews.changed_files_summary` [`true`]; `reviews.collapse_walkthrough` [`true`]; `reviews.review_status` [`true`]; `reviews.path_filters` [`[]`, globs, `!` excludes]; `reviews.path_instructions` (per-path guidance, 20,000 chars max); `reviews.auto_review.ignore_title_keywords`, `.labels` (`!` excludes), `.base_branches`; `tone_instructions` [`""`, 250 chars]; `reviews.request_changes_workflow` [`false`]; `reviews.commit_status` [`true`] / `fail_commit_status` [`false`].

**Pros.** Genuinely free for this repo, no card. Team-tier features. Models are OpenAI/Anthropic ("Neither CodeRabbit, OpenAI, nor Anthropic uses your code to train our models") so it is independent of the writing model. On-request by construction at 0 stars, which is the comment-trigger shape the merge gate wants.

**Cons.** Manual trigger means someone (or the gate script) has to comment. Rate limit can be as low as 1 review/hour on a 0-star repo. The walkthrough comment is verbose unless trimmed. Model-output logging: the FAQ says the opt-out setting "does not change existing logging behavior for public or open-source repositories" — i.e. outputs on public repos may be logged.

**Verdict.** Adopt as the on-request second opinion. Have the merge gate (or the writer) post `@coderabbitai review` after promoting the PR from draft, and keep `auto_review.drafts: false` so nothing fires early even once the repo passes 10 stars.

### 2. Macroscope — no public-repo tier; limits unchanged

**Eligibility wording.** The docs pricing page lists no open-source or public-repository offering, and a search of macroscope.com / docs.macroscope.com found none. The only "free for open source" mention surfaced is from a third-party directory (aicodereview.cc) — **unverified and contradicted by the primary pricing page**.

**What is free.** "New workspaces receive $100 in free usage." and "1,000 free Agent credits per month; these credits do not roll over." "1 Agent credit = $0.01." Agent credits cover CLI reviews, Check Run Agents, Approvability, Fix-it-for-me, Ask Macroscope, Macros and the API; CLI reviews "use Agent credits, based on actual model usage plus markup" and "no CLI mode has a per-KB rate."

**GitHub PR review billing.** "$0.025–$0.20 per KB, depending on detection mode; 10 KB minimum per review." Budget $0.025/KB ($0.25 min), Balanced (default) $0.05/KB ($0.50), Precise $0.06/KB ($0.60), Ultra $0.20/KB ($2.00). Status (commit summaries): "$0.05 per successfully summarized commit." Approvability: 30 credits per run.

**Triggers and drafts.** Per-repo Correctness setting: "Always run", "Manual invocation only", or "Never run". Manual: comment `@macroscope-app review`; "a manual request bypasses the automatic run-count and correctness spend caps" (per-review cap default $10, per-PR cap $50; it does not bypass the monthly workspace limit or an exhausted balance). "Review Draft PRs" is a separate setting, and "Switching a draft PR to ready for review will trigger a Macroscope Correctness check." Mode labels `macroscope-budget` / `-balanced` / `-precise` / `-ultra` pick the mode per PR.

**Noise controls.** Minimum Severity to Comment (Low/Medium/High/Critical/Off; "Off posts all findings"); Max Automatic Runs per PR; Max Reviewable File Size; Skip Dependabot; Skip PRs by Author / Labels / Target Branches; a skip label; ignore rules (`ignoreTests` etc.).

**Verdict.** Nothing to change. The current "Manual invocation only + `@macroscope-app review` on `complex`" policy is exactly the cheapest configuration the docs offer. If the summaries that woke threads were Status commit summaries, note they bill $0.05/commit as well as being noisy.

### 3. GitHub Copilot code review — not free; paid Pro works for the owner, not for `vmb-agent`'s PRs automatically

**Plan gating.** "users on the Copilot Free plan, which does not include Copilot code review." The plans page marks Copilot Free's code review as limited to "Review selection" in VS Code and excludes PR summaries. Automatic review of your own PRs "is available on the Copilot Pro, Copilot Pro+, and Copilot Max plans"; Pro is $10/month with 1,500 AI credits/month (1,000 base + 500 flex), Pro+ $39 (7,000), Max $100 (20,000). Free Pro exists only "As a verified teacher on GitHub Education" or "As a maintainer of a popular open-source repository" — the docs do not define "popular" or "open-source"; a 0-star proprietary repo will not qualify.

**Cost per review.** "A review typically consumes an estimated $0.05 USD to $1 USD worth of AI credits with "Lite" effort" and "$0.25 USD to $5 USD worth of AI credits with "Balanced" effort"; overage is "$0.01 USD per AI credit". My arithmetic, not GitHub's: Pro's 1,500 credits buy roughly 15–300 Lite or 3–60 Balanced reviews a month. The Actions billing page says Copilot code review on public repositories keeps its Actions minutes free.

**Who can trigger it here.** "In personal repositories, only the repository owner or a direct collaborator can request a review." Repository-level automatic review lets "Repository owners ... configure Copilot to automatically review all pull requests in the repository that are created by people with access to Copilot." `vmb-agent` has no Copilot plan, so PRs it opens would not be auto-reviewed by that path (inference from the quoted sentence; **not tested**). Ruleset-based automatic review ("Automatically request Copilot code review", with optional "Review new pushes" and "Review draft pull requests") is configured under Settings → Rulesets; the docs say ruleset reviews still run where personal-setting reviews do not, but do not say who is billed when the author has no plan — **unverified**. Manual: Reviewers → Copilot → Request, re-request via the same menu; "Copilot reviews a PR only once" unless push reviews are on.

**Drafts.** "Pull requests are automatically reviewed while they are still drafts, before you switch them to "Open"." is an opt-in setting (off by default).

**Noise controls.** `.github/copilot-instructions.md` and `.github/instructions/**/*.instructions.md` for guidance; "Lite" effort; no push reviews; no draft reviews. Certain file types are never reviewed (dependency manifests, logs, SVGs).

**Verdict.** Only worth it if `ubeann` already holds Copilot Pro for other reasons; then a manual request on `complex` PRs is a cheap third opinion on a model family other than Claude. Not a free-tier win for this repo.

### 4. Gemini Code Assist for GitHub — free consumer status not confirmed on current docs; dropped by the owner anyway

**History.** The owner dropped Gemini as a reviewer on 2026-10-18 for unreliability in agent-driven sessions (that was the Antigravity/CLI path, not the GitHub app). Facts for the record:

**Current primary sources.** The old `developers.google.com/gemini-code-assist/docs/review-github-code` URL now 301s to `docs.cloud.google.com/gemini/docs/code-review/review-repo-code`, which describes only "an enterprise version, which you install through Google Cloud" under "Google Cloud terms of service" with "100+ pull requests per day". The GitHub App listing (`github.com/apps/gemini-code-assist`) states "This app is only available for Google Cloud customers." The quotas page says "An installation of the Gemini Code Assist on GitHub app has a quota of at least 100 pull request reviews per day." and "Usage of Gemini Code Assist on GitHub is not counted as part of the general quotas for Gemini Code Assist." A search snippet of an earlier version of that page mentioned a "consumer version" with "33 pull request reviews per day", but the live page no longer says so — **the free consumer tier's current availability is unverified**; the 2025 "free for individuals" coverage is secondary and dated.

**Config (`.gemini/config.yaml`, verbatim defaults).** `have_fun` ("Enables fun features such as a poem ... Default: false"); `ignore_patterns` (globs, default `[]`); `code_review.disable` ("Disables Gemini from acting on pull requests. Default: false"); `code_review.comment_severity_threshold` ("Default: MEDIUM", values LOW/MEDIUM/HIGH/CRITICAL); `code_review.max_review_comments` ("Use -1 for unlimited. Default: -1"); `code_review.pull_request_opened.help` (default `false`), `.summary` (default `false`), `.code_review` (default `true`), `.include_drafts` ("Enables agent functionality on draft pull requests. Default: true"). A `styleguide.md` is supported (page does not state the path; the schema page says `config.yaml` lives in `.gemini/`). Files under `.github/workflows` are never reviewed. Comment trigger: "adding the `/gemini` tag to your comments".

**Verdict.** Not a candidate: the owner dropped it, the free consumer path cannot be confirmed from today's docs, and by default it reviews drafts (`include_drafts: true`) — the opposite of what this repo wants.

### 5. Sourcery — qualifies (public), automatic, drafts skipped by default

**Eligibility wording.** Pricing page: Open Source is "Free" / "forever", "Code review for public repos", "Install Sourcery on your public repositories on GitHub or GitLab." Plans doc: Open Source — Price "Free", for "Public repositories." No OSI or non-commercial condition on either page.

**What you get.** "Code review on pull requests, reviewer's guide/summary/diagrams, IDE reviews and recipes, and review rules." Not included: analytics, private repos, user-triggered security scans, Jira autocreate, Security REST API. Security scanning is a limited preview (3 repos, twice weekly, 10 visible findings). Paid: Pro $12/dev/mo annual ($15 monthly), Team $24 ($30); 14-day Team trial, no card.

**Limits (Open Source).** Per-PR cap 150,000 diff characters (a bigger diff is skipped); rolling 7-day budget 250,000 diff characters per developer (not pooled on the free plan); a re-review costs a tenth of a review; "a rate limit never blocks a merge."

**Install.** Sourcery dashboard → "Log in with GitHub" → "Pick the organization or personal account where you want reviews" (for a personal account "you already have the permissions needed") → choose repositories → authorise.

**Draft and comment behaviour.** Reviews run "as soon as it opens, and again when you push new commits." "Draft pull requests ... Sourcery skips them by default"; a "Review draft pull requests" setting turns that on. So a PR opened as draft is reviewed when it is marked ready — i.e. when the merge gate promotes it. Dependency-bot PRs and packaging-only changes are skipped by default. Commands as PR comments: `@sourcery-ai review` ("Runs a full review on demand and resets the per-pull-request re-review counter."), `summary`, `guide`, `title`, `resolve`, `dismiss` ("Dismisses the Sourcery review status check."), `create issue`.

**Noise controls (dashboard, per repo via "Use Organization Settings" off).** Master switch ("Turn it off and Sourcery posts nothing on a repository's pull requests."); independent toggles for AI review comments, pull request summary, review guide, sequence diagrams, tips and commands; review profile Quiet ("only the highest-priority comments") / Balanced (default) / Verbose; ignore-title keywords; label allowlist; base-branch regex allowlist; path filters (glob list excluding files from the reviewed diff); custom review rules. Settings are dashboard-side, not a repo file.

**Pros.** Only licence-free tier found that reviews every PR automatically with a published quota. Default draft-skipping matches this repo's flow with zero config. Fine-grained "post nothing but inline comments" controls. A `dismiss` command for the status check.

**Cons.** Diff-character budget is per developer and the bot author is one "developer", so a busy week of large PRs can hit 250k and silently skip reviews. The model vendor is not stated on the pages fetched, so "independent of Claude" is likely but **unverified**. Custom rules are dashboard-managed, so they are not versioned in the repo.

**Verdict.** Adopt as the automatic independent reviewer. Quiet profile, summary/guide/diagrams/tips off, drafts off, path filters for lockfiles and generated output.

### 6. Greptile — does not qualify

**Eligibility wording.** Pricing page: "Greptile is free for qualified non-commercial projects with an OSI-approved license." Open-source page: "eligible non-commercial open-source project", "public on GitHub or GitLab, have at least 50 stars, and use an OSI-approved license", "not part of a commercial product". This repo fails licence, stars and commercial status.

**Other free option.** A "Starter" plan appears on the pricing page: "Free", "1 active developer", "50 credits per month", "unlimited repositories". The billing doc defines "1 credit = 1 Base review" (Plus 3, Apex 10) and "An active developer is anyone with at least one completed review charged to them in the billing period." The billing doc does not mention Starter, so **the Starter plan's existence rests on the pricing page alone** (a third-party tracker dates it to July 2026). Paid: Pro $30/seat/mo with 50 credits, $1 per extra credit.

**Verdict.** Skip the OSS programme. The Starter plan (if it is as the pricing page says) would give ~50 base reviews a month for one developer with no licence condition; worth a look only if Sourcery + CodeRabbit prove insufficient.

### 7. Qodo (hosted) and PR-Agent (self-hosted) — hosted eligibility uncertain; self-hosted is free software but spends your API key

**Hosted Qodo.** Pricing page: "We don't offer a permanent free tier." (14-day trial, no card; Pro Team $30 with credit packs at "$.012/credit"). FAQ: "Qualified open source projects can apply to the Qodo for Open Source program for free access." — the page does not define "qualified", and the programme page URL (`/open-source/`) returned 404. The 2025-10-16 blog post says the review agent "is now completely free for public open-source repositories", "Free. Forever. For Open Source.", installed via the Qodo GitHub App, with no licence or non-commercial wording. Whether "open-source" there means "public" or "OSI-licensed" is **not determinable from primary sources**; assume an application would be judged on licence. Hosted triggers: "Qodo runs a review as soon as a pull request is opened, reopened, or marked ready for review" (so drafts wait until promoted); manual `/agentic_review`; optional "Review every push".

**PR-Agent (open source, MIT).** The repo states: "This repository contains the open-source PR Agent Project. It is not the Qodo offering for open-source projects." and "This project is not the Qodo free tier." It runs as a GitHub Action (`the-pr-agent/pr-agent@main`) with your own key — "AI Models: OpenAI GPT, Anthropic Claude, Google Gemini, DeepSeek, Mistral, and any other model reachable through LiteLLM". The install doc's workflow triggers on `pull_request` (`opened`, `reopened`, `ready_for_review`, optionally `synchronize`) and `issue_comment`, skips bot senders, needs `contents: read`, `issues: write`, `pull-requests: write`, and takes `github_action_config.auto_review` / `auto_describe` / `auto_improve` as `"true"`/`"false"`. For Claude: `config.model: anthropic/claude-opus-5`, `config.fallback_models: ["anthropic/claude-haiku-4-5-20251001"]`, secret passed as `ANTHROPIC.KEY`. Actions minutes are free on a public repo; the model calls are not.

**Verdict.** Hosted Qodo: do not apply unless the owner is comfortable asserting "open source" for a viewing-only licence — probably not. PR-Agent: not "free capacity" (it spends an Anthropic/OpenAI key) and it is same-family as the writer if run on Claude; keep as a fallback pattern only.

### 8. Other reviewers checked

- **Korbit** — homepage: "Korbit Max is free for all open source repositories!"; Pro $12/user annual ($15 monthly), Max $18 ($24), 14-day trial. No definition of "open source"; the pricing URL 404s and every "Request Demo" button links to boostsecurity.io. A third-party aggregator claims the app and docs hosts no longer resolve — **product status unverified**. Not recommended until the owner checks the app still installs.
- **Graphite** — Hobby tier is "Free", "Personal account repos support", "Limited AI Reviews" (no number published; pricing FAQ: "If you're using Graphite with your personal repositories, your workspace will be placed into the free Hobby tier"). This repo is on a personal account, so Hobby applies, but the quota is undisclosed. The separate Diamond-for-OSS programme requires "an OSI-approved open-source license" and is "exclusively for non-commercial open-source projects" — not eligible. Team ($40/user/mo annual) has "Unlimited AI Reviews".
- **Cursor Bugbot** — comparison table marks Bugbot "—" on the Free plan; it comes with Premium ($30/mo) and above. No OSS offer.
- **Bito** — Team $12–15/seat, Professional $20–25/seat ("5K lines/seat/month included, $5 per 1K after"); 14-day trial; no OSS or public-repo tier.
- **Ellipsis** — usage-based ("Tokens: At cost, no markup", "platform fee: 10% of token cost", "$0" seats). The pricing FAQ lists "Is it free for open source?" but the answer did not render in the fetch — **unverified**; no free tier found on the docs site.
- **Codacy** — see static-analysis group below (it also has an "AI Reviewer").

### 9. Static analysis and security group (free on public repos)

- **GitHub-native.** Security-features page: secret scanning, push protection, code scanning and the CodeQL CLI are each "Available for public repositories by default."; private repos need GitHub Code Security / Secret Protection, which "You must be on a GitHub Team or GitHub Enterprise plan in order to purchase". Code scanning default setup eligibility: "GitHub Actions is enabled." and "It is publicly visible, or GitHub Code Security is enabled."; "Analysis of JavaScript/TypeScript, Go, Ruby, Python, and Kotlin code does not currently require special configuration." If a repo sees no pushes or PRs for six months, the weekly schedule is disabled. Secret scanning "runs automatically for free" on public repos; push protection for users "Is enabled by default" and "Stops you from pushing secrets to public repositories on GitHub." Actions: "GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners." (larger runners are "always charged for, even when used by public repositories"). Dependabot alerts are listed in GitHub Free; dependency graph, Dependabot alerts, security and version updates sit under "Available for all GitHub plans" with no GHAS product required (the Dependabot pages themselves carry no cost statement). The repo already has `.github/dependabot.yml`.
- **Semgrep Free Edition.** "Maximum 10 contributors", "Scan up to 10 repositories", private repos 10 max, "Public repositories: unlimited"; a contributor is someone who committed to a _private_ scanned repo in the past 90 days. Includes Code (SAST, Pro Engine/Rules, cross-file taint) and Supply Chain, PR/MR integration, 60 AI credits; excludes Secrets detection. No licence wording — public repos qualify outright.
- **SonarQube Cloud.** Free plan: "Analysis of public projects: unlimited number of projects" but "Only main branch analysis" and PRs "Only if the target branch is the main branch" — so PR decoration on `master`-targeted PRs is available even on the Free plan (every PR here targets `master`). The OSS plan ("unlimited access to branch analysis and pull request analysis", "no private projects") is described on the pricing page as "Public, OSI-licensed repos get SonarQube for OSS" — not eligible. Team from $32–34/mo (page is inconsistent).
- **Codacy.** Pricing: "Free forever for open-source projects"; FAQ: after the trial "keep scanning your public repositories for free on the Open Source plan". No licence condition found on the pricing page or in search of docs.codacy.com. Team $18/dev/mo annual ($21 monthly) adds "AI Reviewer & Merge Gates for Pull Requests"; the page does not state whether the AI Reviewer is part of the Open Source plan — **unverified**.

## Comparison table

| Tool                                              | Free tier gate                                               | This repo qualifies?    | Auto review                    | Drafts (default)                  | Comment trigger                          | Published limit                                         | Key noise controls                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------ | ----------------------- | ------------------------------ | --------------------------------- | ---------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| CodeRabbit                                        | Public repo                                                  | Yes                     | No at < 10 stars (manual only) | Skipped (`drafts: false`)         | `@coderabbitai review` / `full review`   | 1–10 reviews/h per dev per repo; 100–300 files          | profile `quiet`/`chill`, summary/poem/diagrams off, path filters, labels, `ignore`       |
| Sourcery                                          | Public repo                                                  | Yes                     | Yes                            | Skipped                           | `@sourcery-ai review`                    | 250k diff chars / 7 days / dev; 150k per PR             | Quiet profile, per-item toggles, path filters, labels, master switch                     |
| Macroscope                                        | None (usage billed)                                          | n/a                     | Configurable (Manual here)     | Setting                           | `@macroscope-app review`                 | $100 welcome; 1,000 agent credits/mo; $0.05/KB Balanced | Severity threshold, run caps, skip labels/authors, ignore rules                          |
| Copilot code review                               | Paid plan (Pro+)                                             | Only with paid Pro      | Personal/ruleset settings      | Opt-in                            | Reviewers → Request (owner/collaborator) | AI credits: $0.05–1 Lite, $0.25–5 Balanced per review   | Lite effort, instructions files, no push/draft reviews                                   |
| Gemini Code Assist (GitHub)                       | "Google Cloud customers" (consumer tier unverified)          | Unclear                 | Yes                            | Reviewed (`include_drafts: true`) | `/gemini review`                         | 100+/day per installation                               | `comment_severity_threshold`, `max_review_comments`, `summary: false`, `ignore_patterns` |
| Greptile OSS                                      | OSI + non-commercial + 50 stars                              | No                      | —                              | —                                 | —                                        | —                                                       | —                                                                                        |
| Greptile Starter                                  | None stated (pricing page only)                              | Probably                | Yes                            | Unknown                           | Unknown                                  | 50 credits/mo, 1 developer                              | Unknown                                                                                  |
| Qodo hosted                                       | "public open-source repositories" (undefined)                | Uncertain               | Yes                            | Waits for ready                   | `/agentic_review`                        | Not stated for OSS                                      | Trigger setting                                                                          |
| PR-Agent (self-hosted)                            | MIT software; your API key                                   | Yes (not free capacity) | Workflow-defined               | `ready_for_review` event          | `issue_comment`                          | Your key                                                | `auto_review/describe/improve` flags                                                     |
| Graphite Hobby                                    | Personal-account repos                                       | Yes                     | Yes                            | Unknown                           | Unknown                                  | "Limited" (undisclosed)                                 | Unknown                                                                                  |
| Graphite Diamond OSS                              | OSI + non-commercial                                         | No                      | —                              | —                                 | —                                        | —                                                       | —                                                                                        |
| Korbit                                            | "all open source repositories" (undefined; status uncertain) | Uncertain               | Unknown                        | Unknown                           | Unknown                                  | Unknown                                                 | Unknown                                                                                  |
| Cursor Bugbot / Bito / Ellipsis                   | No free tier found                                           | No                      | —                              | —                                 | —                                        | —                                                       | —                                                                                        |
| Semgrep Free                                      | Public repos unlimited                                       | Yes                     | CI scan + PR comments          | n/a                               | n/a                                      | 10 private-repo contributors                            | Policy engine                                                                            |
| SonarQube Cloud Free                              | Public projects                                              | Yes (main-branch PRs)   | PR analysis to `master`        | n/a                               | n/a                                      | Main branch only                                        | Quality gate                                                                             |
| SonarQube Cloud OSS                               | "Public, OSI-licensed"                                       | No                      | —                              | —                                 | —                                        | —                                                       | —                                                                                        |
| Codacy Open Source                                | Public repos                                                 | Yes                     | PR analysis                    | n/a                               | n/a                                      | Not stated                                              | Dashboard                                                                                |
| GitHub CodeQL / secret scanning / push protection | Public repo                                                  | Yes                     | Default setup                  | n/a                               | n/a                                      | Free Actions minutes on standard runners                | Alert severity, paths in config                                                          |

## Recommended setup for ubeann/vmb

Ordered so that each step is free, reversible and does not comment on drafts.

1. **GitHub-native (no vendor account).** Settings → Code security: enable **Code scanning → Default setup** (JavaScript/TypeScript needs no extra config); confirm **Secret scanning** and **Push protection** show as enabled (default for public repos). Keep `.github/dependabot.yml`. Nothing here posts PR comments; findings appear as check annotations and in the Security tab, so no thread is woken.

2. **Sourcery — the automatic independent reviewer.** Install from the dashboard on the personal account with access limited to `vmb`. Then in the repo's review settings turn "Use Organization Settings" off and set: profile **Quiet**; **Review draft pull requests off** (default); **Pull request summary off**, **Review guide off**, **Sequence diagrams off**, **Tips and commands off**; **AI review comments on**; path filters `pnpm-lock.yaml`, `**/*.snap`, `**/generated/**`, `docs/**` (adjust to taste); ignore-title keyword `WIP`. Add a review rule or two from `CODING_STANDARDS.md` only after a week of watching the signal-to-noise. Because drafts are skipped, the first review lands exactly when the gate promotes the PR; a later `@sourcery-ai review` re-runs on demand, and `@sourcery-ai dismiss` clears the status check if it is wrong.

3. **CodeRabbit — the on-request second opinion.** Install on the personal account, repo `vmb` only. Commit this `.coderabbit.yaml` at the repo root:

   ```yaml
   # CodeRabbit: on-request only. At <10 stars the OSS plan needs a manual
   # trigger anyway; these settings keep it that way once that changes.
   language: en-GB
   tone_instructions: "Terse. Correctness and security findings only; no praise, no style nits."
   reviews:
     profile: chill # or quiet once the volume is known
     high_level_summary: false
     poem: false
     sequence_diagrams: false
     changed_files_summary: false
     collapse_walkthrough: true
     review_status: false
     request_changes_workflow: false
     auto_review:
       enabled: false # never auto-review; the gate comments to trigger
       drafts: false
       ignore_title_keywords: ["WIP"]
     path_filters:
       - "!pnpm-lock.yaml"
       - "!**/*.snap"
       - "!docs/**"
     path_instructions:
       - path: "apps/web/src/**"
         instructions: "SvelteKit + Svelte 5 runes. Flag auth, CSP, SQL and form-action input handling bugs first."
   ```

   Then extend the merge-gate script: after it flips a PR from draft to ready and CI is green, post `@coderabbitai review` (the first time, check that a comment from `vmb-agent` triggers a review; if it does not, have the owner's account post it). Use `@coderabbitai rate limit` if reviews stop arriving — a 0-star repo may get 1 review/hour.

4. **Macroscope — unchanged.** Keep Correctness on "Manual invocation only", `@macroscope-app review` on `complex` PRs, severity threshold at Medium or above, and Status summaries off. The repo going public changes none of its billing.

5. **Optional static layer.** Add Semgrep Free Edition (a single `semgrep ci` job; public repo, no contributor cap concerns) and/or SonarQube Cloud Free (PR analysis works because every PR targets `master`). Both post check results rather than conversational comments; enable PR comments only if the team reads them.

6. **Do not apply to** Greptile OSS, Graphite Diamond OSS or SonarQube OSS: each requires an OSI-approved licence and the first two add "non-commercial". Do not apply to Qodo for Open Source either unless the owner is willing to describe the project as open source, which the licence contradicts.

7. **Update `docs/agents/model-routing.md`** once steps 2–3 have run for a week: Sourcery becomes the automatic independent-model layer on `standard` and `complex`; CodeRabbit on request; Macroscope stays the paid, deeper pass on `complex`. Record the decision as an ADR if the review ladder changes.

**How each slots into the current flow.** `/code-review` (Claude, in-session) stays the Spec/Standards reviewer. Sourcery and CodeRabbit are both "independent-model bug hunters" — neither reads the ticket, both read the diff — so they replace the cross-provider Gemini session the owner just dropped, at zero quota cost. Noise risk is real for Sourcery (automatic on every promoted PR); the Quiet profile and the all-off summary toggles are the mitigation, and the master switch is the kill switch. CodeRabbit, being comment-triggered here, can only wake a thread when asked.

## Review by

2026-11-18. Pricing pages in this space changed between fetches on the same day (CodeRabbit Marketplace vs docs tier naming; SonarQube Team price). Re-check in particular: CodeRabbit's "< 10 stars" rule and OSS hourly limit, Sourcery's diff-character budget, Macroscope's free agent credits, whether Gemini's consumer GitHub app still exists, and Korbit's status.

## Sources

All accessed 2026-10-18 unless stated.

- CodeRabbit Docs — [Plans and rate limits](https://docs.coderabbit.ai/management/plans); [Configuration reference](https://docs.coderabbit.ai/reference/configuration); [Commands](https://docs.coderabbit.ai/guides/commands); [FAQ](https://docs.coderabbit.ai/faq); [GitHub.com integration](https://docs.coderabbit.ai/platforms/github-com)
- CodeRabbit — [Pricing](https://www.coderabbit.ai/pricing); GitHub Marketplace — [CodeRabbit listing](https://github.com/marketplace/coderabbitai)
- Macroscope Docs — [Pricing](https://docs.macroscope.com/pricing); [Correctness](https://docs.macroscope.com/correctness); [CLI](https://docs.macroscope.com/cli); [Spend limits](https://docs.macroscope.com/spend-limits); [Setup](https://docs.macroscope.com/setup-instructions); [Docs index](https://docs.macroscope.com/) — macroscope.com/pricing itself rendered only navigation
- GitHub Docs — [Copilot code review (concept)](https://docs.github.com/en/copilot/concepts/agents/code-review); [Configure automatic code review](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/configure-automatic-review); [Use code review](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review); [Copilot plans](https://docs.github.com/en/copilot/get-started/plans); [Get free access to Copilot Pro](https://docs.github.com/en/copilot/how-tos/manage-your-account/get-free-access-to-copilot-pro)
- GitHub Docs — [About billing for GitHub Actions](https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions); [Configuring default setup for code scanning](https://docs.github.com/en/code-security/code-scanning/enabling-code-scanning/configuring-default-setup-for-code-scanning); [About secret scanning](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning); [About push protection](https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection); [GitHub security features](https://docs.github.com/en/code-security/getting-started/github-security-features); [About GitHub Advanced Security](https://docs.github.com/en/get-started/learning-about-github/about-github-advanced-security); [GitHub's plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans); [About Dependabot alerts](https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts); [About Dependabot security updates](https://docs.github.com/en/code-security/dependabot/dependabot-security-updates/about-dependabot-security-updates); [About Dependabot version updates](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates)
- Google Cloud Docs — [Review repo code (Gemini Code Assist on GitHub)](https://docs.cloud.google.com/gemini/docs/code-review/review-repo-code) (redirect target of developers.google.com/gemini-code-assist/docs/review-github-code); [Customize repo review](https://docs.cloud.google.com/gemini/docs/code-review/customize-repo-review); [Quotas](https://docs.cloud.google.com/gemini/docs/quotas); GitHub — [Gemini Code Assist app](https://github.com/apps/gemini-code-assist)
- Sourcery — [Pricing](https://sourcery.ai/pricing); Docs — [Plans](https://docs.sourcery.ai/admin/plans/); [Code review overview](https://docs.sourcery.ai/Code-Review/); [Commands](https://docs.sourcery.ai/reviews/commands/); [Configure reviews](https://docs.sourcery.ai/reviews/configure/); [Quickstart on GitHub.com](https://docs.sourcery.ai/start/quickstart-github/)
- Greptile — [Pricing](https://www.greptile.com/pricing); [Open source programme](https://www.greptile.com/open-source); [Billing and seats](https://www.greptile.com/docs/code-review-bot/billing-seats.md)
- Qodo — [Pricing](https://www.qodo.ai/pricing/); [Blog: free initiative with Google Cloud (2025-10-16)](https://www.qodo.ai/blog/cleaning-up-bugs-in-the-open-source-community-with-qodo-a-free-initiative-in-collaboration-with-google-cloud); Docs — [Code review](https://docs.qodo.ai/code-review); [Use Qodo in PRs](https://docs.qodo.ai/code-review/use-qodo-in-prs); GitHub — [qodo-ai/pr-agent](https://github.com/qodo-ai/pr-agent) and its [GitHub installation doc](https://raw.githubusercontent.com/qodo-ai/pr-agent/main/docs/docs/installation/github.md) — qodo.ai/open-source/ returned 404
- Graphite — [Pricing](https://graphite.com/pricing); [Pricing FAQ](https://graphite.com/docs/pricing-faq); [Diamond for open source](https://www.graphite.com/lp/diamond-oss)
- Cursor — [Pricing](https://cursor.com/pricing); Bito — [Pricing](https://bito.ai/pricing/); Ellipsis — [Pricing](https://www.ellipsis.dev/pricing) and [Docs](https://www.ellipsis.dev/docs); Korbit — [Homepage](https://www.korbit.ai/) (korbit.ai/pricing returned 404)
- SonarSource — [SonarQube Cloud pricing](https://www.sonarsource.com/products/sonarcloud/pricing/); Docs — [Subscription plans](https://docs.sonarsource.com/sonarcloud/administering-sonarcloud/managing-subscription/subscription-plans); Community — [Introducing the new Free OSS Plan](https://community.sonarsource.com/t/introducing-the-new-free-oss-plan-in-sonarqube-cloud/176923)
- Codacy — [Pricing](https://www.codacy.com/pricing); Semgrep — [Pricing](https://semgrep.dev/pricing)
- `gh api repos/ubeann/vmb` (live: public, User-owned, 0 stars, licence NOASSERTION); `LICENSE`; `docs/agents/model-routing.md` "Review" section; `.github/dependabot.yml` — read 2026-10-18

## Caveats

- Fetches were summarised by an automated reader; quoted strings were returned as page text, but open the linked page before acting on any number.
- Gemini's consumer GitHub app could not be located on current official pages; everything about a free consumer tier is from dated secondary coverage or a stale search snippet.
- Whether a `@coderabbitai review` comment from the `vmb-agent` collaborator triggers a review, and whether Copilot ruleset reviews run (and bill) for PRs authored by an account without Copilot, were not tested.
- Korbit, Ellipsis and Greptile Starter rest on a single primary page each (homepage / pricing card) with gaps the vendors' docs do not fill.
- "Qualifies" above means the vendor's published gate is satisfied on its face; none of these vendors publishes how it audits licences, and a vendor may still decline a viewing-only-licence repo on its own programme's judgement.
