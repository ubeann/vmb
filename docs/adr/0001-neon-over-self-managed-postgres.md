# ADR-0001: Database — Neon over self-managed Postgres

**Context:** Legacy app used a self-managed Postgres instance. Small internal user base, low traffic, cost-sensitivity.

**Options considered:**

- Keep self-managed Postgres (e.g., on a VPS)
- Supabase
- Neon

**Decision:** Neon.

**Trade-offs:** Free tier autosuspends compute after idle, causing 1–3s cold-start latency on first query. Acceptable given internal, sporadic usage pattern. Gains: zero server maintenance, branch-per-PR workflow for isolated testing.
