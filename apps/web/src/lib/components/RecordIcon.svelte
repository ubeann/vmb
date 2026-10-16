<script lang="ts">
  import { GLYPHS } from "./icons/glyphs.js";
  import { FALLBACK_ICON, resolveIcon } from "./icons/stored.js";

  // A record's stored icon (#176). Decorative by default; pass `label` when the icon is the only carrier of meaning.
  let {
    name,
    label,
    class: className
  }: { name: string; label?: string; class?: string } = $props();

  const key = $derived(resolveIcon(name) ?? FALLBACK_ICON);
  const Icon = $derived(GLYPHS[key]);
</script>

<Icon
  class={className}
  data-icon={key}
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
/>
