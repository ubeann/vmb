# ADR-0005: Frontend framework — SvelteKit over Next.js

**Context:** Replacing Laravel Filament's admin UI; app is CRUD/form-heavy rather than content/marketing-heavy.

**Options considered:**
- Next.js
- SvelteKit

**Decision:** SvelteKit.

**Trade-offs:** Smaller ecosystem/hiring pool than Next.js/React, fewer prebuilt admin-panel templates. Gains: less boilerplate for form-heavy CRUD screens, smaller bundle size, file-based routing + form actions feel closer to Filament's "batteries included" DX than Next's App Router.
