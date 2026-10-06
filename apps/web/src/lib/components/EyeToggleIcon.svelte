<!--
  The password toggle's glyph: Lucide's eye, with a slash that draws across it
  when the characters are shown and lifts off when they are hidden again. The
  gap around the slash is cut through a mask, so it reads on any field colour.
  A moving icon (ADR-0035 rule 3) drawn here because the registry's eye blinks
  on hover and its eye-off shakes, which reads as an error. CSS only, timed by
  the icon tokens; reduced motion swaps it at once. Decorative.
-->
<script lang="ts">
  let { off, class: className }: { off: boolean; class?: string } = $props();

  const id = $props.id();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  class={["eye-toggle", { off }, className]}
>
  <mask id="{id}-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
    <rect width="24" height="24" fill="#fff" stroke="none" />
    <path d="m2 2 20 20" stroke="#000" stroke-width="5" pathLength="1" class="slash" />
  </mask>
  <g mask="url(#{id}-cut)">
    <path
      d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
    />
    <circle cx="12" cy="12" r="3" />
  </g>
  <path d="m2 2 20 20" pathLength="1" class="slash" />
</svg>

<style>
  .slash {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    transition: stroke-dashoffset var(--duration-exit) var(--easing-standard);
  }

  .off .slash {
    stroke-dashoffset: 0;
    transition-duration: var(--duration-icon);
  }
</style>
