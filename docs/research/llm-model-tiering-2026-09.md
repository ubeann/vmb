# Research: LLM model tiering for a usage-limited AI coding agent (T3 Code)

Researched 2026-09-24 against primary sources (OpenAI's and Anthropic's own developer docs and
pricing pages) wherever they could be fetched directly, cross-checked against llm-stats.com and
Artificial Analysis (both explicitly flagged as secondary/aggregated). Every claim below carries a
source URL and the access date. This is a market/pricing snapshot, not a domain or architecture
decision, so it lives here rather than in `CONTEXT.md` or `docs/adr/` (see "Where this was saved"
at the end).

**Review by: 2026-12-24 (quarterly).** Both platforms in this table shipped new model waves inside
the three weeks before this research, and the task brief that produced this file flagged quarterly
releases as the norm — so treat this snapshot, and the routing table in `docs/agents/git-workflow.md`
that depends on it, as due for re-verification once that date passes. Re-running the same research
brief (fetch each provider's current pricing/model-docs pages, re-check llm-stats.com /
Artificial Analysis) is enough; update both this file and the `git-workflow.md` table together so
they don't drift apart.

**Scope.** The developer's tool (T3 Code) currently favorites, per provider:

- OpenAI: `GPT-6-Sol`, `GPT-6-Astra`, `GPT-6-Luna`
- Anthropic: `Claude Opus 5.5`, `Claude Sonnet 5`

Both providers shipped new model waves in the three weeks before this research (OpenAI: GPT-6
Astra on Sept 3 2026, GPT-6 Sol/Luna on Sept 22 2026; Anthropic: Claude Opus 5.5 on Sept 22 2026),
so this snapshot is close to the leading edge and will go stale quickly — see Caveats.

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

---

## Comparison table

| Model                                 | Provider  | Price in / out per MTok (short-context)                                                                               | Context window / max output   | Coding/agentic benchmark                                                                                                                                                                                                                                 | Notes                                                                                                            |
| ------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| GPT-6 Luna                            | OpenAI    | $0.10 / $0.50 (long-context: $0.20 / $0.75)                                                                           | 1.05M (922K max input) / 128K | DeepSWE v1.1 ≈64% (aggregator roundup, down from predecessor Luna's 66%); Coding Agent Index 41 (Artificial Analysis, aggregator)                                                                                                                        | Cheapest tier, "fast responses, high volume." Released Sept 22 2026.                                             |
| GPT-6 Sol                             | OpenAI    | $2.00 / $10.00 (long-context: $4 / $15)                                                                               | 1.05M (922K max input) / 128K | DeepSWE v1.1 ≈68.8% (aggregator roundup)                                                                                                                                                                                                                 | Mid-tier, "complex coding and agentic workflows." Released Sept 22 2026. Price-matches Claude Sonnet 5 exactly.  |
| GPT-6 Astra                           | OpenAI    | $10.00 / $50.00 (long-context: $20 / $75)                                                                             | 1.05M (922K max input) / 128K | DeepSWE v1.1 74.1% (from OpenAI's own launch materials, via secondary paraphrase — not independently fetched); Artificial Analysis Coding Agent Index 62 (aggregator, level with Claude Fable 5.1, ahead of Claude Opus 5's 60)                          | Flagship, "hardest end-to-end work," computer use. Released Sept 3 2026.                                         |
| Claude Haiku 4.5                      | Anthropic | $1.00 / $5.00                                                                                                         | 200K / not separately stated  | Not found for this specific model                                                                                                                                                                                                                        | Not in the user's picker; shown for reference as Anthropic's cheap tier (matches the $1/$5 the user cited).      |
| Claude Sonnet 5                       | Anthropic | $2.00 / $10.00 (confirmed as _standard_, not introductory — a scheduled Sept 1 2026 increase to $3/$15 was cancelled) | 1M / 128K                     | SWE-bench Verified 85.2% (llm-stats.com leaderboard, aggregator, directly fetched 2026-09-24)                                                                                                                                                            | "Most agentic Sonnet yet." Price-matches GPT-6 Sol exactly.                                                      |
| Claude Opus 5                         | Anthropic | $5.00 / $25.00                                                                                                        | 1M / 128K                     | SWE-bench Verified figures for this exact model were inconsistent across aggregators (one cited ~72.5%, likely stale); sibling Opus 4.8 scores 88.6% on the same llm-stats leaderboard                                                                   | Being superseded by Opus 5.5 at a lower price.                                                                   |
| Claude Opus 5.5                       | Anthropic | $4.00 / $20.00 (Fast mode: $8/$40)                                                                                    | 1M / 128K                     | SWE-bench Pro 89.9%, Terminal-Bench 66.4%, CursorBench 57.8% (Anthropic's own Opus 5.5 System Card — found via search snippet, PDF too large to fetch directly, see caveats); Artificial Analysis Intelligence Index 58 vs GPT-6 Astra's 53 (aggregator) | Flagship, positioned by Anthropic as "Fable 5.1-class work" at ~20% below Opus 5's price. Released Sept 22 2026. |
| Claude Fable 5 / 5.1 (reference only) | Anthropic | $10.00 / $50.00                                                                                                       | 1M / 128K                     | SWE-bench Verified 95.0% (Fable 5, llm-stats leaderboard, aggregator) — current #1 on that leaderboard                                                                                                                                                   | Not in the user's picker. Anthropic's top-of-line tier, shown for context on where Opus sits below it.           |

Throughput/speed (tokens-per-second) data was pulled from llm-stats.com model pages but the three
fetches returned inconsistent percentile conventions (p95 vs p5, characters/sec rather than
tokens/sec) — treat any speed comparison as directional only; see Caveats. Rough figures seen: GPT-6
Astra ≈69 chars/s sustained output, ~8.9s p95 time-to-first-token; Claude Opus 5.5 ≈176 chars/s
(p95), ~9.5s p95 TTFT; Claude Sonnet 5 ≈16 chars/s (reported as p5, i.e. slow-tail, not comparable
to the other two figures as extracted).

---

## Recommendation

### Daily driver vs. complex-task, per provider

| Provider  | Daily driver (routine tickets) | Complex-task (hard tickets)  | Why                                                                                                                                                                                                                                                                                                                               |
| --------- | ------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI    | **GPT-6 Sol** ($2/$10)         | **GPT-6 Astra** ($10/$50)    | Sol gets "complex coding and agentic workflows" positioning at 1/5 Astra's price; reserve Astra for tickets where Sol's DeepSWE gap (~68.8% vs 74.1%, aggregator numbers) actually matters.                                                                                                                                       |
| Anthropic | **Claude Sonnet 5** ($2/$10)   | **Claude Opus 5.5** ($4/$20) | Sonnet 5 is the cheaper of the two "daily driver" candidates system-wide (tied with Sol) and benchmarks at 85.2% SWE-bench Verified (aggregator); Opus 5.5 is Anthropic's best $/capability complex-task option — cheaper than Opus 5 it replaces and, per Artificial Analysis, ahead of GPT-6 Astra on their Intelligence Index. |

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

**Secondary / aggregator (explicitly flagged inline above wherever used):**

- `llm-stats.com/benchmarks/swe-bench-verified` — fetched directly, accessed 2026-09-24 (SWE-bench Verified leaderboard scores for Claude Sonnet 5, Opus 4.8/4.7/4.6/4.5, Fable 5, Mythos Preview, GPT-5.2; did **not** yet list GPT-6 Astra/Sol/Luna or Claude Opus 5.5)
- `llm-stats.com/models/gpt-6-astra`, `.../claude-opus-5-5`, `.../claude-sonnet-5` — fetched directly, accessed 2026-09-24 (throughput/latency figures, cross-check on pricing/context window)
- Artificial Analysis comparison/benchmarking pages (`artificialanalysis.ai/models/comparisons/...`, `artificialanalysis.ai/articles/benchmarking-gpt-6-astra`) — referenced via search results, accessed 2026-09-24 (Intelligence Index, Coding Agent Index, blended cost-per-task figures)
- Aggregator roundup blogs (Vellum, DataCamp, LayerLens, MetricNexus, BenchLM, CodingFleet, TechCrunch, MacRumors, TheNewStack, and similar) — referenced via search results only, accessed 2026-09-24, used for DeepSWE v1.1 scores and launch-date/positioning color where no primary figure was found

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

## Where this was saved

`docs/research/` already exists in this repo and is the established location for standalone
research notes (it holds `drizzle-baseline-and-better-auth.md`, `legacy-schema-inventory.md`,
`migration-test-harness.md`, and `uuidv7-support.md`, all following the same
"researched-on-this-date, primary-sources-cited" convention used here). This file follows that
existing convention rather than introducing a new one.
