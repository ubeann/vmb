// The UI motion durations from app.css (ADR-0040), in milliseconds, for
// Svelte transitions and Tween/Spring, which take numbers rather than custom
// properties. motion.test.ts keeps the two in step. Each use still gates on
// `prefersReducedMotion` (ADR-0035 rule 6).
export const duration = {
  feedback: 120,
  panel: 220,
  icon: 300
} as const;
