# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Staff of PT. Vifiera Minova Bersaudara who keep the company's records: warehouse, trucking and expense clerks, the people who approve their requests, and the admins who manage Users, Roles and Divisions. Use is split between office desktops and phones in the field (the warehouse floor, trucking dispatch), in roughly equal measure. A User belongs to one or more Divisions through the Roles they hold (`GLOSSARY.md`).

## Product Purpose

VMB is the internal tool where warehouse Items, trucking Orders and Trips, and Division Expense Requests are kept on record and approved. It replaces the legacy Laravel + Filament app (`ubeann/vmb-warehouse`); during the migration, legacy behaviour is the parity reference (`docs/agents/legacy-reference.md`). Success is staff doing their daily record-keeping faster and with fewer mistakes than in the legacy app.

## Positioning

It is the company's own system of record for three separate domains (warehouse, trucking, expense) that share Users, Roles and Approvals but are not one process. Nothing in it should suggest a warehouse-to-truck-to-approval pipeline.

## Operating Context

- Signed-out pages: `/login`, and `/activate`, which serves both first-time activation of a migrated User and password reset (one-time code by email, then a new password). There is no self-registration and no separate forgot-password page (`GLOSSARY.md`, ADR-0033).
- Signed-in pages: the app shell with Master CRUD (Users, Roles, Divisions) now, then each domain's CRUD screens.
- Field use happens on phones, on mobile networks, often one-handed.

## Capabilities and Constraints

- Terminology comes from `GLOSSARY.md`; use its terms and avoid the listed alternatives.
- UI copy is English today. A Bahasa Indonesia translation is planned, so layouts must leave room for longer strings and must not bake text into images.
- Stack and hosting are decided (`docs/ARCHITECTURE.md`): SvelteKit on Cloudflare Pages, Tailwind v4 and shadcn-svelte (ADR-0035), no JS motion library (ADR-0040).
- Every design-system change (palette, font, motion tokens) is recorded as an ADR next to ADR-0035 and ADR-0036.

## Brand Commitments

- **The etched look is binding.** The auth and error pages are an engraved plate: navy ink and the logo green on warm paper, line-engraved art drawn as token-filled masks. The world is defined by `docs/design/etched-login/README.md` and the rounds after it in `docs/design/`, not restated here.
- **Brand line:** _Every crate, container and receipt, on record._
- **Logo:** `VmbLogo.svelte` (source `docs/design/etched-login/vmb-logo.svg`), navy swoosh and green striped letterforms.
- **Tokens and rules:** `apps/web/src/app.css` is the single source of tokens; ADR-0035 (design system), ADR-0036 (palette and type), ADR-0040 (motion), and the Rules section of `docs/agents/design-workflow.md` bind every surface.

## Evidence on Hand

- Production art from Recraft with commercial rights, under `docs/design/*/sources/` and `apps/web/src/lib/assets/`.
- No customers, testimonials or metrics: VMB is internal. Never invent them.

## Product Principles

1. The form comes first: every task screen is usable before, during and without its art.
2. Records are trusted: the interface reads as careful and exact, never playful about data.
3. Three domains, three places: show them as separate, never as one flow.
4. Accessible by default: WCAG 2.2 AA is a per-PR gate (ADR-0035 rule 6).

## Accessibility & Inclusion

WCAG 2.2 AA on every page: 4.5:1 text contrast, 3:1 for field boundaries and focus indicators, 44px targets on touch pointers, reduced motion shows finished states, motion plays once and nothing moves near a focused field.
