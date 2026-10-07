---
version: 1
slug: "apps-web-src-routes-auth-login-page-svelte"
primary_target: "apps/web/src/routes/(auth)/login/+page.svelte"
related_targets:
  [
    "apps/web/src/routes/(auth)/activate/+page.svelte",
    "apps/web/src/lib/components/AuthShell.svelte"
  ]
---

# Auth pages (/login, /activate)

**Mode: Operate.** The visitor's success is getting signed in, or getting a code and setting a password, fast and without doubt. Scanability, native form behaviour and the real usage scene (desk and phone, half the time in the field) outrank expression. Brand lives in precise details.

**Scope: refinement, not redesign.** Keep the etched world exactly as shipped (`docs/design/etched-login/README.md`, `docs/design/etched-scenes/`, `docs/design/activate-mark/`, `docs/design/password-mark/`): masthead, brand line, ruled sheet, plate, sky, flock, footer strip, copy, routes, form semantics and tests. Treat it as the incumbent authority, never as an anti-reference.

**Audience and job:** PT. Vifiera Minova Bersaudara staff. `/login`: email and password, optional Remember me. `/activate`: one route, three steps (email → six-digit code → new password); it is both first-time activation and password reset. No register or forgot-password pages.

**Constraints:** ADR-0035 (tokens only, WCAG 2.2 AA), ADR-0036 (palette), ADR-0046 (Newsreader display cut, Schibsted Grotesk UI, JetBrains Mono for codes), ADR-0040 (CSS and Svelte built-ins only; durations and easings from `app.css` tokens; reduced motion shows the finished state), design-workflow Rules (2.5rem clear zone around text, form first, motion plays once, no ambient motion near a focused field; one-shot feedback for the user's own action may play there). Text must allow for a planned Bahasa Indonesia translation.

**This round's goals (pilot of impeccable, 2026-10-06):** type that doesn't feel generic; micro-interactions for code sent, submit state, show/hide password, and the code-to-password step change, all within ADR-0040.

**Unresolved:** whether a type change is auth-only or app-wide (asked before the ADR).
