<!--
  The reading under a new-password field (ADR-0041): one bar for the length rule
  and the advice. The tick is the minimum, and past it the fill goes on to the
  full mark. Text says the same, so colour is not the only cue. Advice only: the
  schema is what blocks.
-->
<script lang="ts">
  import {
    PASSWORD_BAR_FULL_AT,
    PASSWORD_MIN_MARK,
    passwordBarFill,
    passwordReading,
    passwordStrength
  } from "$lib/password-strength.js";

  let { length }: { length: number } = $props();

  const strength = $derived(passwordStrength(length));
</script>

<div
  role="meter"
  aria-label="Password length"
  aria-valuemin={0}
  aria-valuemax={PASSWORD_BAR_FULL_AT}
  aria-valuenow={Math.min(length, PASSWORD_BAR_FULL_AT)}
  aria-valuetext={passwordReading(length)}
  data-password-strength={strength ?? "none"}
  class="bg-border relative h-1.5 overflow-hidden rounded-full"
>
  <div
    class={[
      "h-full transition-[clip-path,background-color] duration-(--duration-feedback) ease-(--easing-standard) motion-reduce:transition-none",
      strength ? "bg-primary" : "bg-muted-foreground"
    ]}
    style="clip-path: inset(0 {100 - passwordBarFill(length) * 100}% 0 0 round 9999px)"
  ></div>
  <div class="bg-card absolute inset-y-0 w-0.5" style="left: {PASSWORD_MIN_MARK * 100}%"></div>
</div>
<p class={strength ? "text-foreground" : "text-muted-foreground"}>
  {passwordReading(length)}
</p>
