# ADR-0014: Cloudflare Queues — not needed for MVP

**Context:** `ARCHITECTURE.md` §2 listed Cloudflare Queues as "if needed," for operations that risk the Workers free-tier 10ms CPU limit (§6). The legacy Laravel app configures a queue connection, but a review of its usage found no job ever actually dispatched to it — it's unused infrastructure, not evidence of a real background-processing need.

**Options considered:**

- Provision Cloudflare Queues now, ahead of any concrete heavy endpoint, to match the legacy app's configuration.
- Skip Queues for the MVP; revisit only if a specific endpoint (e.g. bulk import/export, report generation) is measured to risk the CPU limit.

**Decision:** Not needed for MVP.

**Trade-offs:** Matching the legacy app's queue _configuration_ would add operational surface (a queue to provision, monitor, and reason about) for a capability it never actually used. Skipping it keeps the initial scaffold simpler; the risk is a heavy endpoint later needing to be split into a background job under time pressure, which §6 already flags as something to watch for during migration.
