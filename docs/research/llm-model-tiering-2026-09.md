# Research: LLM model tiering for a usage-limited AI coding agent (T3 Code)

Researched 2026-09-24 against primary sources (OpenAI's and Anthropic's own developer docs and
pricing pages) wherever they could be fetched directly, cross-checked against llm-stats.com and
Artificial Analysis (both explicitly flagged as secondary/aggregated). Every claim below carries a
source URL and the access date. This is a market/pricing snapshot, not a domain or architecture
decision, so it lives here rather than in `CONTEXT.md` or `docs/adr/` (see "Where this was saved"
at the end).

**Updated 2026-09-27:** added Gemini (Google) and OpenCode (OpenCode Go, serving DeepSeek V4.1
Flash) for issue #183, using the same method. All original OpenAI/Anthropic content is unchanged
and still dated 2026-09-24. Every new claim is dated 2026-09-27.

**Review by: 2026-12-24 (quarterly), or as soon as a provider is added to T3 Code's routing,
whichever comes first.** Both platforms in the original table shipped new model waves inside the
three weeks before this research, and the task brief that produced this file flagged quarterly
releases as the norm. Treat this snapshot, and the routing table in `docs/agents/git-workflow.md`
that depends on it, as due for re-verification once that date passes. Also re-verify when a new
provider joins the picker, because a new provider can change which model is cheapest or strongest
in a tier (as Gemini and OpenCode Go did in the 2026-09-27 update). Re-running the same research
brief (fetch each provider's current pricing/model-docs pages, re-check llm-stats.com /
Artificial Analysis) is enough. Update this file and the `git-workflow.md` table together so
they don't drift apart.

**Scope.** The developer's tool (T3 Code) currently favorites, per provider:

- OpenAI: `GPT-6-Sol`, `GPT-6-Astra`, `GPT-6-Luna`
- Anthropic: `Claude Opus 5.5`, `Claude Sonnet 5`
- Gemini (added 2026-09-27): `gemini-3.8-flash-high`. T3 Code runs Gemini through its
  `antigravity` driver (Google's Antigravity CLI), not Gemini CLI. T3 Code's own model manifest
  (`~/.t3/userdata/model-manifest.json`, `updatedAt` 2026-09-24, read locally 2026-09-27) lists
  exactly three current Antigravity models: `gemini-3.8-flash-high`, `-medium`, and `-low`. These
  are one model, Gemini 3.8 Flash, at three thinking levels. No Gemini Pro model is offered in the
  picker.
- OpenCode (added 2026-09-27): `opencode-go/deepseek-v4.1-flash`, which is DeepSeek V4.1 Flash
  served through the OpenCode Go subscription. T3 Code's favorites (`client-settings.json`, read
  locally 2026-09-27) also include `opencode-go/gpt-5.6-luna`, `glm-5.3-flash`, `glm-5.3`,
  `grok-4.6`, `grok-4.7`, and `kimi-k3`. Those are **out of scope** for this update (see Caveats).

Both original providers shipped new model waves in the three weeks before this research (OpenAI:
GPT-6 Astra on Sept 3 2026, GPT-6 Sol/Luna on Sept 22 2026; Anthropic: Claude Opus 5.5 on Sept 22
2026). The two new models are just as recent: Gemini 3.8 Flash shipped Sept 2 2026 and DeepSeek
V4.1 Flash shipped Sept 10 2026. This snapshot is close to the leading edge and will go stale
quickly (see Caveats).

---

## Executive summary

**The "GPT-6-Sol/Astra/Luna" names are not aliases — they are OpenAI's real, current, official
model names**, confirmed directly against OpenAI's own developer docs
(`developers.openai.com/api/docs/models/gpt-6-{astra,sol,luna}` and
`.../api/docs/pricing`, accessed 2026-09-24). GPT-6 Astra is the flagship ($10/$50 per MTok
in/out), GPT-6 Sol is the mid-tier reasoning/coding model ($2/$10), and GPT-6 Luna is the cheap,
fast, high-volume model ($0.10/$0.50). All three share a 1.05M-token context window with a 128K
max output.

On the Anthropic side, Claude Sonnet 5 ($2/$10) and Claude Opus 5.5 ($4/$20) are confirmed current
via Anthropic's own pricing docs (`platform.claude.com/docs/en/about-claude/pricing`), and both
also carry a 1M-token context window / 128K max output.

**Recommendation, in short:** for a usage-limited quota, run **GPT-6 Sol or Claude Sonnet 5 as the
daily driver** for routine tickets — they are priced identically ($2 in / $10 out per MTok) and
both benchmark well on agentic coding — and **escalate hard tickets to Claude Opus 5.5** rather
than GPT-6 Astra as the first choice: Opus 5.5 is 2.5x cheaper per output token than Astra ($20 vs
$50/MTok) while scoring at least as well on the one aggregator index that covers both (Artificial
Analysis Intelligence Index, 58 vs 53) — Astra's Coding Agent Index score (62) has no Opus 5.5
counterpart in the sources found, so treat coding-specific standing between these two as
unverified, not comparable, until that gap is closed. Reserve GPT-6 Astra as a fallback
/ second opinion for OpenAI-ecosystem-specific work (Codex harness, computer-use). Use GPT-6 Luna
for genuinely trivial, mechanical tickets to avoid burning daily-driver quota on work that doesn't
need it. **Tagging tickets with a complexity label to route the model is a good practice** given
the ~100x price spread between the cheapest and most expensive models in this lineup (Luna at
$0.10/$0.50 vs Astra at $10/$50) — see the 3-tier scheme in Recommendation below.

**Gemini and OpenCode (added 2026-09-27).** T3 Code offers exactly one Gemini model, **Gemini 3.8
Flash**, at low, medium, or high thinking. Google's API rate for it is $0.75/$3.75 per MTok until
Dec 31 2026, rising to $1.50/$7.50 on Jan 1 2027. It has a 1M context window and a 64K max output.
On DeepSWE v1.1 it is roughly level with the flagships: 73.7% against GPT-6 Astra's 74.1%, per
aggregators relaying Google's figures. On the harder Terminal-Bench 4.0 it falls far behind (19.1%
against Claude Opus 5's 51.8%, same sources). **DeepSeek V4.1 Flash via OpenCode Go** is the
cheapest capable model found. DeepSeek meters it at $0.15/$0.60 off-peak and $0.30/$1.20 peak,
with a 1M context window and a 384K max output. DeepSeek's own model card reports 74.2% on DeepSWE
v1.1 and 31.2% on Terminal-Bench 4.0; no independent run of either was found. Through OpenCode Go
it is not billed per token. OpenCode Go is a **$10/month flat subscription** with a dollar-metered
allowance of $60/month for this model, capped at 20% of that per 5 hours and 50% per week. Until
those caps are hit, each extra ticket costs nothing, which changes the cost comparison below. T3
Code's Gemini access is also a subscription-style quota rather than per-token billing: it
authenticates Antigravity CLI with a personal Google account, and Google doesn't publish absolute
limits for that quota. **Proposed tiers:** DeepSeek V4.1 Flash goes in **fast** (`trivial`). It
could plausibly move up to daily, but every coding benchmark for it is self-reported, so there
isn't enough evidence to place it there yet. Gemini 3.8 Flash is a **fast/daily** candidate and
not frontier. Where Gemini sits in routing (a tier slot or a second-opinion reviewer) is **pending
the human decision in #184**. Neither Google nor DeepSeek documents a co-author address. OpenCode
wrote `noreply@opencode.ai` in 2025, but the current release doesn't write it, and OpenCode's docs
never mention it. See "AI co-author addresses" below.

---

## Comparison table

| Model                                                     | Provider                     | Price in / out per MTok (short-context)                                                                                                                                                                                                                                    | Context window / max output                                                                           | Coding/agentic benchmark                                                                                                                                                                                                                                                                                                                                                                                                                            | Notes                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GPT-6 Luna                                                | OpenAI                       | $0.10 / $0.50 (long-context: $0.20 / $0.75)                                                                                                                                                                                                                                | 1.05M (922K max input) / 128K                                                                         | DeepSWE v1.1 ≈64% (aggregator roundup, down from predecessor Luna's 66%); Coding Agent Index 41 (Artificial Analysis, aggregator)                                                                                                                                                                                                                                                                                                                   | Cheapest tier, "fast responses, high volume." Released Sept 22 2026.                                                                                                                                                                                                                                                                                                      |
| GPT-6 Sol                                                 | OpenAI                       | $2.00 / $10.00 (long-context: $4 / $15)                                                                                                                                                                                                                                    | 1.05M (922K max input) / 128K                                                                         | DeepSWE v1.1 ≈68.8% (aggregator roundup)                                                                                                                                                                                                                                                                                                                                                                                                            | Mid-tier, "complex coding and agentic workflows." Released Sept 22 2026. Price-matches Claude Sonnet 5 exactly.                                                                                                                                                                                                                                                           |
| GPT-6 Astra                                               | OpenAI                       | $10.00 / $50.00 (long-context: $20 / $75)                                                                                                                                                                                                                                  | 1.05M (922K max input) / 128K                                                                         | DeepSWE v1.1 74.1% (from OpenAI's own launch materials, via secondary paraphrase — not independently fetched); Artificial Analysis Coding Agent Index 62 (aggregator, level with Claude Fable 5.1, ahead of Claude Opus 5's 60)                                                                                                                                                                                                                     | Flagship, "hardest end-to-end work," computer use. Released Sept 3 2026.                                                                                                                                                                                                                                                                                                  |
| Claude Haiku 4.5                                          | Anthropic                    | $1.00 / $5.00                                                                                                                                                                                                                                                              | 200K / not separately stated                                                                          | Not found for this specific model                                                                                                                                                                                                                                                                                                                                                                                                                   | Not in the user's picker; shown for reference as Anthropic's cheap tier (matches the $1/$5 the user cited).                                                                                                                                                                                                                                                               |
| Claude Sonnet 5                                           | Anthropic                    | $2.00 / $10.00 (confirmed as _standard_, not introductory — a scheduled Sept 1 2026 increase to $3/$15 was cancelled)                                                                                                                                                      | 1M / 128K                                                                                             | SWE-bench Verified 85.2% (llm-stats.com leaderboard, aggregator, directly fetched 2026-09-24)                                                                                                                                                                                                                                                                                                                                                       | "Most agentic Sonnet yet." Price-matches GPT-6 Sol exactly.                                                                                                                                                                                                                                                                                                               |
| Claude Opus 5                                             | Anthropic                    | $5.00 / $25.00                                                                                                                                                                                                                                                             | 1M / 128K                                                                                             | SWE-bench Verified figures for this exact model were inconsistent across aggregators (one cited ~72.5%, likely stale); sibling Opus 4.8 scores 88.6% on the same llm-stats leaderboard                                                                                                                                                                                                                                                              | Being superseded by Opus 5.5 at a lower price.                                                                                                                                                                                                                                                                                                                            |
| Claude Opus 5.5                                           | Anthropic                    | $4.00 / $20.00 (Fast mode: $8/$40)                                                                                                                                                                                                                                         | 1M / 128K                                                                                             | SWE-bench Pro 89.9%, Terminal-Bench 66.4%, CursorBench 57.8% (Anthropic's own Opus 5.5 System Card — found via search snippet, PDF too large to fetch directly, see caveats); Artificial Analysis Intelligence Index 58 vs GPT-6 Astra's 53 (aggregator)                                                                                                                                                                                            | Flagship, positioned by Anthropic as "Fable 5.1-class work" at ~20% below Opus 5's price. Released Sept 22 2026.                                                                                                                                                                                                                                                          |
| Claude Fable 5 / 5.1 (reference only)                     | Anthropic                    | $10.00 / $50.00                                                                                                                                                                                                                                                            | 1M / 128K                                                                                             | SWE-bench Verified 95.0% (Fable 5, llm-stats leaderboard, aggregator) — current #1 on that leaderboard                                                                                                                                                                                                                                                                                                                                              | Not in the user's picker. Anthropic's top-of-line tier, shown for context on where Opus sits below it.                                                                                                                                                                                                                                                                    |
| Gemini 3.8 Flash (added 2026-09-27)                       | Google                       | $0.75 / $3.75 introductory, through Dec 31 2026; $1.50 / $7.50 from Jan 1 2027 (Gemini API paid tier, primary). In T3 Code this model runs on the Antigravity subscription quota, not per token (see "Billing models")                                                     | 1,048,576 / 65,536 (primary)                                                                          | DeepSWE v1.1 73.7%, Terminal-Bench 2.1 89.4%, Terminal-Bench 4.0 19.1% (Vellum and similar roundups relaying Google's evaluation doc, aggregator; Google's own eval PDF was fetched but its results table is an image and couldn't be extracted). Artificial Analysis Intelligence Index v4.3.2: 41 at high thinking (aggregator; the 58 and 53 figures in the rows above carry no recorded index version, so treat the two sets as not comparable) | GA, released Sept 2 2026. Google positions it for "long-horizon software engineering, autonomous agents." Thinking levels low/medium/high map one-to-one onto T3 Code's `-low`/`-medium`/`-high` entries. The only Gemini model in T3 Code's picker. AA measured 330 tok/s output but a 22.6s time to first token (aggregator).                                           |
| Gemini 3.1 Pro Preview (reference only, added 2026-09-27) | Google                       | $2.00 / $12.00 up to 200K context; $4.00 / $18.00 above 200K (primary)                                                                                                                                                                                                     | 1,048,576 / 65,536 (primary)                                                                          | Not gathered for this model                                                                                                                                                                                                                                                                                                                                                                                                                         | **Not in T3 Code's picker** (the manifest lists only 3.8 Flash). Still a preview, with a model page last updated Feb 2026. Antigravity's baseline quota includes it. Shown only as Google's nearest "Pro"-class option.                                                                                                                                                   |
| DeepSeek V4.1 Flash via OpenCode Go (added 2026-09-27)    | OpenCode (model by DeepSeek) | Via OpenCode Go: **$10/month flat**, with a $60/month metered allowance for this model. OpenCode meters that allowance at the same per-token rates DeepSeek's own API charges: $0.15 / $0.60 off-peak, $0.30 / $1.20 peak, and $0.003 / $0.006 cached input (both primary) | 1M / 384K (DeepSeek API docs, primary; llm-stats lists 393,200, which is 384 × 1,024, the same limit) | DeepSWE v1.1 74.2%, Terminal-Bench 2.1 90.6%, Terminal-Bench 3.0 30.0%, Terminal-Bench 4.0 31.2% (DeepSeek's own model card and API changelog: primary, **self-reported**). Artificial Analysis Intelligence Index v4.3.2: 39 at "Reasoning, Max Effort" (aggregator; one AA page variant showed 40)                                                                                                                                                | Released Sept 10 2026. Open-weight (MIT). A mixture-of-experts model with 552B parameters, 8B active in prefill and 16B in decode. Peak pricing applies Mon–Fri 01:00–04:00 and 06:00–10:00 UTC. The DeepSeek API model name is now `deepseek-flash`; in OpenCode it is `deepseek-v4.1-flash`. AA measured 237 tok/s output and a 0.99s time to first token (aggregator). |

Throughput/speed (tokens-per-second) data was pulled from llm-stats.com model pages but the three
fetches returned inconsistent percentile conventions (p95 vs p5, characters/sec rather than
tokens/sec) — treat any speed comparison as directional only; see Caveats. Rough figures seen: GPT-6
Astra ≈69 chars/s sustained output, ~8.9s p95 time-to-first-token; Claude Opus 5.5 ≈176 chars/s
(p95), ~9.5s p95 TTFT; Claude Sonnet 5 ≈16 chars/s (reported as p5, i.e. slow-tail, not comparable
to the other two figures as extracted).

### Billing models: per-token vs. subscription quota (added 2026-09-27)

The OpenAI and Anthropic rows above use per-token API prices. For the two new providers, T3 Code
doesn't pay per token, so their per-token prices are for reference only.

**OpenCode Go (flat-rate subscription, dollar-metered caps).** Figures from
`opencode.ai/docs/go/` (page "last updated Sep 26, 2026") and `opencode.ai/go`, both accessed
2026-09-27:

- **Price:** $10/month. No first-month discount is mentioned.
- **Metering:** each model has a monthly dollar allowance, consumed at per-token rates. For
  DeepSeek V4.1 Flash the allowance is **$60/month**, at $0.15/$0.60 per MTok off-peak and
  $0.30/$1.20 peak. Those are the same rates DeepSeek's own API charges. OpenCode's own estimate is
  about 130,000 requests/month (26,000 per 5 hours, 65,000 per week).
- **Rolling caps:** usage in any 5-hour window is capped at 20% of the monthly allowance ($12 for
  this model), usage in any week at 50% ($30), and usage in the month at 100% ($60).
- **Over the cap:** usage is blocked unless the **Use balance** option is on. With it on, usage
  continues at per-token rates, paid from prepaid OpenCode Zen credits.
- **What this means for tiering:** within the caps, each extra ticket costs $0. The $10/month is a
  sunk cost, and the effective budget is the $12-per-5-hours cap, not a per-token price. At
  off-peak output rates, $60 is about 100M output tokens. That is our own arithmetic (60 ÷ 0.60),
  not an OpenCode figure. Flat-rate billing suits the **fast** tier best: a high volume of small
  mechanical tickets that would otherwise eat into the per-token or plan quota of the daily-driver
  models. The rolling 5-hour cap is the constraint to watch for bursty work. A long, hard ticket is
  the worst fit, because it burns the cap on a model whose hard-agentic evidence (Terminal-Bench
  4.0: 31.2%, self-reported) trails the frontier models.

**Gemini: per-token API vs. Gemini CLI vs. Antigravity CLI quota.**

- **Per-token:** the Gemini API paid tier bills per token at the rates in the table
  (`ai.google.dev/gemini-api/docs/pricing`, "Last updated 2026-09-24 UTC", accessed 2026-09-27).
  Gemini 3.8 Flash also has a free API tier there.
- **Gemini CLI is no longer the consumer path.** Google's announcement
  (`github.com/google-gemini/gemini-cli/discussions/27274`, accessed 2026-09-27) says that on
  **June 18 2026** Gemini CLI stopped serving free-tier, Google AI Pro, and Google AI Ultra users,
  who were moved to the proprietary **Antigravity CLI**. Gemini CLI stays available to
  Standard/Enterprise licence holders, paid Gemini / Gemini Enterprise Agent Platform API-key users,
  and Google Cloud projects. Gemini CLI's quota page (`geminicli.com/docs/resources/quota-and-pricing/`,
  "last updated June 18, 2026", accessed 2026-09-27) still lists 1,000 requests/user/day on the free
  tier, 1,500/day on AI Pro and on Code Assist Standard, and 2,000/day on AI Ultra and on Code
  Assist Enterprise. It also says API-key usage is billed "based on model and token usage". Given
  the transition, treat the free, Pro, and Ultra figures as historical.
- **T3 Code uses Antigravity CLI** (`providerInstances.antigravity`, `authMethod: oauth-personal`,
  from local T3 Code settings read 2026-09-27), so the Antigravity plan quota is what applies. Per
  `antigravity.google/docs/plans` (accessed 2026-09-27), every plan includes "Gemini models
  including Gemini 3.1 Pro, Gemini 3.8 Flash". Unpaid users get a "meaningful quota, refreshed
  weekly". Google AI Pro gets a "high, generous quota, refreshed every five hours until weekly limit
  reached". Google AI Ultra gets the highest quota. Pro and Ultra users can buy AI credits for usage
  beyond the quota, controlled by an "AI Credit Overages" setting of Never or Always. **Google
  doesn't publish an absolute request or token figure for any Antigravity tier.** An aggregator
  (CloudZero, accessed 2026-09-27) says the same. It gives plan prices of $19.99/month for AI Pro,
  $99.99 for Ultra 5x, and $199.99 for Ultra 20x; those prices weren't confirmed on a Google page
  (see Caveats).
- **What this means for tiering:** like OpenCode Go, Gemini in T3 Code has no marginal per-token
  cost until the quota runs out. But because the quota size isn't published, you can't budget
  against it the way you can against OpenCode Go's dollar caps. It also means the per-token price
  rise on Jan 1 2027 affects T3 Code only if it switches to API-key authentication.

---

## Recommendation

### Daily driver vs. complex-task, per provider

| Provider                    | Daily driver (routine tickets)                                                                                                | Complex-task (hard tickets)                                                                                      | Why                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI                      | **GPT-6 Sol** ($2/$10)                                                                                                        | **GPT-6 Astra** ($10/$50)                                                                                        | Sol gets "complex coding and agentic workflows" positioning at 1/5 Astra's price; reserve Astra for tickets where Sol's DeepSWE gap (~68.8% vs 74.1%, aggregator numbers) actually matters.                                                                                                                                                                                                           |
| Anthropic                   | **Claude Sonnet 5** ($2/$10)                                                                                                  | **Claude Opus 5.5** ($4/$20)                                                                                     | Sonnet 5 is the cheaper of the two "daily driver" candidates system-wide (tied with Sol) and benchmarks at 85.2% SWE-bench Verified (aggregator); Opus 5.5 is Anthropic's best $/capability complex-task option — cheaper than Opus 5 it replaces and, per Artificial Analysis, ahead of GPT-6 Astra on their Intelligence Index.                                                                     |
| Gemini (added 2026-09-27)   | **Gemini 3.8 Flash** at `-high` thinking (Antigravity quota; $0.75/$3.75 API reference) is a candidate. **Role pending #184** | None in the picker. Gemini 3.1 Pro Preview isn't offered by T3 Code, and no coding benchmark was gathered for it | Its DeepSWE v1.1 score (73.7%, aggregator) is level with the flagships at a fraction of the price. But its Terminal-Bench 4.0 score (19.1%, aggregator) is far behind Opus 5 (51.8%), so the evidence doesn't support using it for hard tickets. Whether Gemini takes a tier slot or acts as a cross-provider second-opinion reviewer is a human decision tracked in #184; this file doesn't make it. |
| OpenCode (added 2026-09-27) | None proposed. DeepSeek V4.1 Flash is placed in the **fast** tier, not daily                                                  | None proposed                                                                                                    | DeepSeek V4.1 Flash costs $0 per ticket within OpenCode Go's caps ($10/month flat). DeepSeek self-reports 74.2% on DeepSWE v1.1 and 31.2% on Terminal-Bench 4.0, and no independent run of either was found. On that evidence it is a strong **fast**-tier choice. It would need independent coding benchmarks before it could be trusted as a daily driver.                                          |

**Cross-provider escalation order for hard tickets:** try **Claude Opus 5.5 first**, not GPT-6
Astra — it is 2.5x cheaper per output token ($20 vs $50/MTok) while landing at least as well on the
aggregator benchmarks found. Fall back to GPT-6 Astra for a second opinion, for tasks that need
OpenAI's Codex/computer-use harness specifically, or if Opus 5.5 stalls on a ticket. Use **GPT-6
Luna** for genuinely trivial, mechanical changes (typo fixes, config/version bumps, boilerplate
scaffolding) — at $0.10/$0.50 it is roughly 20-100x cheaper than the daily-driver tier, so routing
trivial work to it materially stretches a shared quota.

### Ticket-complexity labeling: verdict and scheme

**Verdict: yes, this is worth doing.** The price spread across this lineup is close to two orders
of magnitude (Luna's $0.50/MTok output vs Astra's $50/MTok output), and on a usage-limited plan the
marginal cost of routing a trivial ticket to a flagship model — or, worse, routing a genuinely hard
ticket to a cheap model and burning quota on a failed attempt plus a retry at the expensive model —
is exactly what a quota gets exhausted by. A cheap, explicit label removes that judgment call from
each ticket and makes the routing auditable. This repo already tracks issues in GitHub Issues (see
`docs/agents/issue-tracker.md`), so the label can be a normal `gh issue edit --add-label` addition.

**Recommended 3-tier scheme:**

| Label                 | Criteria                                                                                                                                                                                   | Routes to                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `complexity:trivial`  | Mechanical, no design judgment: typo/doc fixes, dependency/version bumps, single obvious line fixes, boilerplate from an established pattern                                               | GPT-6 Luna                                                                         |
| `complexity:standard` | The default. Normal feature work or bug fix scoped to a few files, following existing patterns in the codebase                                                                             | GPT-6 Sol or Claude Sonnet 5 (same price; alternate by provider load/availability) |
| `complexity:complex`  | Cross-cutting or ambiguous requirements, novel architecture/design decisions, security- or data-integrity-sensitive changes, or any ticket that already failed once at the `standard` tier | Claude Opus 5.5 first, GPT-6 Astra as fallback/second opinion                      |

If three tiers is more process than the team wants, collapse to two: `complexity:simple` (Luna or
the daily-driver tier) vs `complexity:complex` (Opus 5.5 / Astra) — simpler to maintain, but loses
the benefit of keeping daily-driver quota off truly trivial tickets.

### Tier → model across all four providers (added 2026-09-27)

Proposed only. The routing table in `docs/agents/git-workflow.md` is **not** changed by this file;
routing by tier and stage is follow-on work in #185. "Fast", "daily", and "frontier" correspond to
`complexity:trivial`, `standard`, and `complex`.

| Tier                                | OpenAI (Codex)                          | Anthropic (Claude)                                      | Gemini (Antigravity), **role pending #184**                                                           | OpenCode (OpenCode Go)                                                                                                                                 |
| ----------------------------------- | --------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **fast** (`complexity:trivial`)     | GPT-6 Luna                              | None in the picker (Claude Haiku 4.5 is reference only) | Gemini 3.8 Flash `-low` (candidate)                                                                   | **DeepSeek V4.1 Flash**, $0 per ticket within the $12-per-5-hours / $30-per-week caps; the strongest fast-tier candidate found, subject to the caveats |
| **daily** (`complexity:standard`)   | GPT-6 Sol                               | Claude Sonnet 5                                         | Gemini 3.8 Flash `-high` (candidate)                                                                  | Not enough evidence yet (DeepSeek V4.1 Flash's benchmarks are self-reported only)                                                                      |
| **frontier** (`complexity:complex`) | GPT-6 Astra (fallback / second opinion) | **Claude Opus 5.5** (first choice)                      | None. 3.8 Flash's Terminal-Bench 4.0 score (19.1%) argues against it, and 3.1 Pro isn't in the picker | None                                                                                                                                                   |

If #184 decides Gemini should be a second-opinion reviewer rather than a tier slot, drop its
column from the routing table. It would instead be used in the review step of #185, where its low
price and different vendor make it a cheap independent check. That is an observation, not a
recommendation this file makes.

### AI co-author addresses (added 2026-09-27)

This follows the resolution order in `docs/agents/git-workflow.md` ("Co-authoring AI-assisted
work"). Only a vendor-**documented** address qualifies for step 3 of that order. Registering the
addresses is follow-on work in #186.

- **Google / Gemini: no vendor-documented address found.**
  - Gemini CLI: the discussion asking how to attribute its commits
    (`github.com/google-gemini/gemini-cli/discussions/11447`, accessed 2026-09-27) has no answer
    from Google.
  - Antigravity CLI (what T3 Code uses) writes no trailer of its own. The feature request asking
    for one, `github.com/google-antigravity/antigravity-cli/issues/230` (opened May 29 2026,
    accessed 2026-09-27), is still open, and no address has been proposed.
  - Jules documents a "Co-authored" commit mode (`jules.google/docs/changelog/2026-02-19/`,
    accessed 2026-09-27) but doesn't state the email address it uses.
  - Two community suggestions exist, and neither is vendor-documented. The first is
    `gemini-code-assist[bot] <176961590+gemini-code-assist[bot]@users.noreply.github.com>`, which
    is the GitHub App account for Gemini Code Assist (a PR-review bot). It was suggested in
    discussion #11447 and is listed by the community repo `github.com/InvictusNavarchus/llm-coauthors`
    (accessed 2026-09-27). It may qualify under step 2 of the order ("the model's own GitHub bot
    account"), but it belongs to a different Google product, so that's a judgment call for #186.
    The second is `gemini@google.com`. It appears in `github.com/google-gemini/gemini-cli/issues/25721`
    (accessed 2026-09-27), where it failed the repo's CLA check. **Don't use it.**
- **OpenCode: no vendor-documented address found.**
  - The OpenCode issue `github.com/anomalyco/opencode/issues/919` (opened July 12 2025, now closed,
    accessed 2026-09-27) says OpenCode used to tag every commit with
    `Co-Authored-By: opencode noreply@opencode.ai` by default.
  - A search of `opencode.ai/docs` (2026-09-27) found no documentation of that address.
  - A string search of the locally installed OpenCode 1.18.32 binary (2026-09-27) found no
    `noreply@opencode.ai`. The only `Co-authored-by` it writes is in GitHub-Action mode, and that
    credits the _triggering human_ (`<actor>@users.noreply.github.com`), not OpenCode.
  - Treat `noreply@opencode.ai` as historical and undocumented.
- **DeepSeek: no vendor-documented address found.** A third-party DeepSeek Harness plugin
  (`github.com/shelken/dsh-co-authored-by`, accessed 2026-09-27) defaults to `noreply@deepseek.com`,
  but that is the plugin author's choice, not DeepSeek's. Under the repo's rule, a DeepSeek-written
  commit falls through to step 4 of the order:
  `Co-Authored-By: DeepSeek V4.1 Flash <noreply@vmblogistics.id>`.

---

## Sources

**Primary — OpenAI:**

- Pricing (fetched directly, primary): `developers.openai.com/api/docs/pricing` — accessed 2026-09-24
- Model docs (fetched directly, primary): `developers.openai.com/api/docs/models/gpt-6-astra`, `.../gpt-6-sol`, `.../gpt-6-luna` — accessed 2026-09-24 (context window, max output, knowledge cutoff)
- `openai.com/index/gpt-6-astra/` and `openai.com/index/introducing-gpt-6-sol-and-luna/` — OpenAI's own announcement posts, **could not be fetched directly (HTTP 403)**; used only indirectly via secondary paraphrase (see Caveats)

**Primary — Anthropic:**

- Pricing (fetched directly, primary): `platform.claude.com/docs/en/about-claude/pricing` — accessed 2026-09-24 (this is the current home for what used to be `docs.anthropic.com/.../pricing`)
- Context windows (fetched directly, primary): `platform.claude.com/docs/en/build-with-claude/context-windows` — accessed 2026-09-24
- `anthropic.com/news/claude-sonnet-5` — fetched directly, primary, accessed 2026-09-24 (release date, positioning; benchmark table present on page but not machine-extractable by the fetch)
- Claude Opus 5.5 System Card PDF: `www-cdn.anthropic.com/.../Claude%20Opus%205.5%20System%20Card.pdf` — primary source, **exceeded fetch tool size limit**; SWE-bench Pro / Terminal-Bench / CursorBench figures cited here came from a search-engine snippet describing this PDF's contents, not a direct fetch (see Caveats)

**Primary — Google (added 2026-09-27, all accessed 2026-09-27):**

- Gemini API pricing (fetched directly): `ai.google.dev/gemini-api/docs/pricing`, "Last updated 2026-09-24 UTC"
- Gemini models list (fetched directly): `ai.google.dev/gemini-api/docs/models`, "last updated 2026-09-24 UTC"
- Per-model pages (fetched directly): `ai.google.dev/gemini-api/docs/models/gemini-3.8-flash` and `.../gemini-3.1-pro-preview` (token limits, thinking levels); `ai.google.dev/gemini-api/docs/latest-model` (GA status, introductory pricing)
- Launch post (fetched directly): `blog.google/innovation-and-ai/models-and-research/gemini-models/3-8-flash-and-3-8-flash-cyber/` (release date Sept 2 2026, positioning; no DeepSWE or Terminal-Bench numbers in its text)
- Evaluation methodology PDF (fetched and text-extracted; results table is an image, see Caveats): `storage.googleapis.com/deepmind-media/gemini/gemini_3-8_flash_model_evaluation.pdf`, redirected from `deepmind.google/models/evals-methodology/gemini-3-8-flash/`
- Gemini CLI to Antigravity CLI transition (fetched directly): `github.com/google-gemini/gemini-cli/discussions/27274`
- Gemini CLI quotas (fetched directly): `geminicli.com/docs/resources/quota-and-pricing/`, "last updated June 18, 2026"; model selection: `geminicli.com/docs/cli/model/`, "last updated March 19, 2026"
- Antigravity plans (fetched directly): `antigravity.google/docs/plans`
- Co-author evidence (fetched directly): `github.com/google-gemini/gemini-cli/discussions/11447`, `github.com/google-gemini/gemini-cli/issues/25721`, `github.com/google-antigravity/antigravity-cli/issues/230`, `jules.google/docs/changelog/2026-02-19/`

**Primary — OpenCode (added 2026-09-27, all accessed 2026-09-27):**

- OpenCode Go docs (fetched directly): `opencode.ai/docs/go/`, "Last updated: Sep 26, 2026" (price, per-model dollar allowances, caps, per-token metering rates, "Use balance" overage)
- OpenCode Go product page (fetched directly): `opencode.ai/go`
- Co-author evidence: `github.com/anomalyco/opencode/issues/919` (fetched directly); a string search of the locally installed OpenCode 1.18.32 binary (`~/.opencode-v1/bin/opencode`)

**Primary — DeepSeek (added 2026-09-27, all accessed 2026-09-27):**

- API pricing and models (fetched directly): `api-docs.deepseek.com/quick_start/pricing` (`deepseek-flash` = DeepSeek-V4.1-Flash; 1M context, 384K max output; off-peak and peak rates)
- API changelog (fetched directly): `api-docs.deepseek.com/updates/` (release Sept 10 2026; self-reported DeepSWE v1.1 74.2 and Terminal-Bench 2.1 90.6)
- Model card (fetched directly): `huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash` (MIT licence, parameter counts, DeepSWE and Terminal-Bench 2.1/3.0/4.0 table)

**Local — T3 Code (added 2026-09-27, read 2026-09-27):**

- `~/.t3/userdata/model-manifest.json` (`currentModels.antigravity`, `updatedAt` 2026-09-24), `~/.t3/userdata/client-settings.json` (favorites), `~/.t3/userdata/settings.json` (`providerInstances.antigravity.config.authMethod = oauth-personal`)

**Secondary / aggregator (explicitly flagged inline above wherever used):**

- `llm-stats.com/benchmarks/swe-bench-verified` — fetched directly, accessed 2026-09-24 (SWE-bench Verified leaderboard scores for Claude Sonnet 5, Opus 4.8/4.7/4.6/4.5, Fable 5, Mythos Preview, GPT-5.2; did **not** yet list GPT-6 Astra/Sol/Luna or Claude Opus 5.5)
- `llm-stats.com/models/gpt-6-astra`, `.../claude-opus-5-5`, `.../claude-sonnet-5` — fetched directly, accessed 2026-09-24 (throughput/latency figures, cross-check on pricing/context window)
- Artificial Analysis comparison/benchmarking pages (`artificialanalysis.ai/models/comparisons/...`, `artificialanalysis.ai/articles/benchmarking-gpt-6-astra`) — referenced via search results, accessed 2026-09-24 (Intelligence Index, Coding Agent Index, blended cost-per-task figures)
- Aggregator roundup blogs (Vellum, DataCamp, LayerLens, MetricNexus, BenchLM, CodingFleet, TechCrunch, MacRumors, TheNewStack, and similar) — referenced via search results only, accessed 2026-09-24, used for DeepSWE v1.1 scores and launch-date/positioning color where no primary figure was found
- (added 2026-09-27) `llm-stats.com/models/gemini-3.8-flash` and `llm-stats.com/models/deepseek-v4.1-flash`: fetched directly, accessed 2026-09-27 (release dates, context and output cross-check, third-party provider pricing; no coding scores listed)
- (added 2026-09-27) `artificialanalysis.ai/models/comparisons/deepseek-v4-1-flash-vs-gemini-3-8-flash`: fetched directly, accessed 2026-09-27 (Intelligence Index v4.3.2, output speed, time to first token)
- (added 2026-09-27) `vellum.ai/blog/gemini-3-8-flash-benchmarks-explained`: fetched directly, accessed 2026-09-27 (Gemini 3.8 Flash DeepSWE v1.1, Terminal-Bench 2.1 and 4.0 with comparison values). DataCamp, CodingFleet, MindStudio, and emergent.sh roundups were seen via search results only (accessed 2026-09-27) and agreed with it
- (added 2026-09-27) `cloudzero.com/blog/google-antigravity-pricing/`: search result only, accessed 2026-09-27 (Antigravity plan prices; says no absolute quota is published)
- (added 2026-09-27) Community co-author lists and plugins: `github.com/InvictusNavarchus/llm-coauthors` (fetched directly) and `github.com/shelken/dsh-co-authored-by` (search result only), both accessed 2026-09-27

---

## Caveats

1. **GPT-6-Sol/Astra/Luna mapping: CONFIRMED, not speculative.** These are OpenAI's actual current
   model names — not internal aliases — verified directly against OpenAI's own developer docs
   (`developers.openai.com/api/docs/models/gpt-6-{astra,sol,luna}`). If T3 Code's picker labels
   differ from this research by punctuation only (hyphen vs space), that's cosmetic.
2. **Aggregator vs. primary source.** llm-stats.com and Artificial Analysis numbers are explicitly
   flagged inline in the comparison table and are third-party benchmark runs/indices, not
   self-reported by OpenAI or Anthropic. Notably, llm-stats.com's SWE-bench Verified leaderboard
   had **not yet been updated** to include GPT-6 Astra/Sol/Luna or Claude Opus 5.5 as of the access
   date — all of those models launched within the three weeks before this research, so the absence
   of a listed score reflects leaderboard lag, not a zero/failing score.
3. **Primary-source access: mostly succeeded, with one notable gap.** `openai.com/index/*`
   announcement blog posts returned HTTP 403 to the fetch tool and could not be read directly;
   OpenAI's pricing and per-model context-window/cutoff data were instead obtained directly from
   `developers.openai.com` (also an OpenAI-owned, official source), so pricing/context-window
   claims for OpenAI are still primary-sourced. Anthropic's docs (`platform.claude.com/docs`,
   `anthropic.com/news`) were fetched directly without issue. The one unresolved gap is Anthropic's
   Opus 5.5 System Card PDF, which is a legitimate primary source but was too large for the fetch
   tool; the specific benchmark numbers attributed to it here (SWE-bench Pro 89.9%, Terminal-Bench
   66.4%, CursorBench 57.8%) should be treated as "primary-sourced but not independently verified
   by direct fetch" until someone opens that PDF directly.
4. **Throughput/speed figures are low-confidence.** The llm-stats.com model-page fetches returned
   inconsistent units and percentile conventions across the three models checked (p95 vs p5,
   characters/sec vs the tokens/sec the task asked for) — likely an artifact of how each page's
   content was summarized during fetch, not a real 10x speed gap. Don't rely on the specific numbers
   in the table above for a throughput decision; re-check the live pages if speed is decision-critical.
5. **Current as of 2026-09-24.** Both providers shipped new models inside the three weeks before
   this research (OpenAI: Astra Sept 3, Sol/Luna Sept 22; Anthropic: Opus 5.5 Sept 22), and pricing
   pages both note recent revisions (e.g. Claude Sonnet 5's introductory price becoming permanent
   on Sept 1 2026). Re-verify pricing/model names before relying on this file more than a few weeks
   out — this is exactly the kind of page that goes stale fast, per the task brief.
6. A background research agent was briefly dispatched in parallel for this same task early in the
   session; it stood down (per an explicit message) before writing any file, gathered a subset of
   the same primary-source pricing facts independently (cross-checked, no contradictions), and did
   not produce a duplicate output.
7. **Gemini 3.8 Flash benchmark numbers are aggregator-relayed (added 2026-09-27).** Google's
   launch post (`blog.google/.../3-8-flash-and-3-8-flash-cyber/`) was fetched directly, and its text
   does **not** contain the DeepSWE 73.7% or Terminal-Bench 2.1 89.4% figures. It says only that 3.8
   Flash "outperforms most larger frontier models" on DeepSWE. Google's evaluation-methodology PDF
   (linked from `deepmind.google/models/evals-methodology/gemini-3-8-flash/`) was fetched and
   text-extracted. It confirms the benchmarks used and that DeepSWE was run "with a mini-swe agent
   harness with high thinking". But its results table is an embedded image, so the numbers couldn't
   be read. The 73.7% / 89.4% / 19.1% figures come from Vellum and similar roundups that say they
   relay Google's table. Treat them as secondary until someone reads the PDF table by eye. No SWE-bench
   Verified or Pro score was found for 3.8 Flash. Its knowledge cutoff isn't stated on the model page.
8. **DeepSeek V4.1 Flash benchmarks are self-reported only (added 2026-09-27).** DeepSWE 74.2% and
   Terminal-Bench 2.1/3.0/4.0 come from DeepSeek's own Hugging Face model card and API changelog.
   llm-stats.com showed no coding scores for it, and Artificial Analysis offers only its composite
   Intelligence Index, which read 39 on one comparison page and 40 on another. No independent
   coding-agent benchmark run was found. This is the main reason it isn't placed in the daily tier.
9. **OpenCode Go hosting and data handling not established (added 2026-09-27).** The OpenCode Go
   pages don't say which inference provider hosts DeepSeek V4.1 Flash, or where. The "data and
   privacy" FAQ answer wasn't in the fetched content. Also, llm-stats lists third-party per-token
   prices for the model (for example Fireworks at $0.22/$0.66), so hosting varies by provider.
   Before sending sensitive code through OpenCode Go, check its privacy terms directly.
10. **Antigravity quota size and plan prices (added 2026-09-27).** Google's Antigravity plans page
    gives only qualitative quotas ("meaningful", "high, generous") and no plan prices. The $19.99 /
    $99.99 / $199.99 prices and the claim that no absolute quota is published come from an
    aggregator (CloudZero, found via search, not fetched directly). The Gemini CLI daily-request
    figures (1,000 / 1,500 / 2,000) come from a page last updated on the day of the Antigravity
    transition, so they may no longer apply to any consumer tier. Whether Antigravity CLI shares its
    quota with the Antigravity IDE isn't stated on the plans page.
11. **T3 Code's model list came from local files, not a public page (added 2026-09-27).** The claim
    that T3 Code offers only `gemini-3.8-flash-{high,medium,low}` through the `antigravity` driver
    comes from `~/.t3/userdata/model-manifest.json` (`updatedAt` 2026-09-24) on the developer's
    machine. The favorites list comes from `~/.t3/userdata/client-settings.json`. Both were read
    locally on 2026-09-27. A later T3 Code manifest could add Gemini Pro models; re-check it at the
    next review.
12. **Out of scope (added 2026-09-27).** The other OpenCode Go favorites (`gpt-5.6-luna`,
    `glm-5.3-flash`, `glm-5.3`, `grok-4.6`, `grok-4.7`, `kimi-k3`) weren't researched. Each has its
    own monthly allowance on OpenCode Go (DeepSeek V4 Pro, for example, gets $15), so their
    flat-rate value differs from DeepSeek V4.1 Flash's. Also, the Gemini API introductory price ends
    Dec 31 2026, which is before this file's Dec 24 review-by date plus a normal re-verification
    lag. Re-check Gemini pricing at that review.
13. **Per-token prices for the new rows are reference values.** In T3 Code neither new provider is
    billed per token (see "Billing models"). Their $/MTok figures are therefore not directly
    comparable with the OpenAI/Anthropic rows when estimating quota burn. They are useful mainly if
    either provider is later used through an API key.

## Where this was saved

`docs/research/` already exists in this repo and is the established location for standalone
research notes (it holds `drizzle-baseline-and-better-auth.md`, `legacy-schema-inventory.md`,
`migration-test-harness.md`, and `uuidv7-support.md`, all following the same
"researched-on-this-date, primary-sources-cited" convention used here). This file follows that
existing convention rather than introducing a new one.
