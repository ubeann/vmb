# ADR-0013: File storage — Cloudflare R2 is needed

**Context:** `ARCHITECTURE.md` §2 listed R2 as "if needed," pending a check of how heavily the legacy app uses file uploads. Per `docs/agents/legacy-reference.md`, the legacy Filament app's `FileUpload` field is used across Clients, Drivers, Routes, Users, Invoices, Orders, Procurement Requests, and Expense Requests — a wide, load-bearing surface, not an edge case.

**Options considered:**
- No object storage; keep files out of scope for the rebuild's initial phases.
- Cloudflare R2 (S3-compatible, no egress fees, same platform as the rest of the stack per ADR-0009).

**Decision:** R2 is needed and will be provisioned as part of the file-upload-bearing modules' migration.

**Trade-offs:** Adds one more Cloudflare resource to provision and secure (bucket-scoped API tokens, access policy), but avoids a second storage vendor and keeps egress free. Given the breadth of legacy `FileUpload` usage, deferring this would just mean re-deciding it under time pressure once the first file-upload module (e.g. Invoices or Procurement Requests) is migrated.
