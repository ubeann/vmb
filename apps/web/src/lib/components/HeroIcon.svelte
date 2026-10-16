<script lang="ts">
  import { FALLBACK_ICON, resolveIcon } from "./hero-icons.js";
  import { GLYPHS } from "./icons/glyphs.js";

  // Decorative by default; pass `label` when the icon is the only carrier of meaning.
  let {
    name,
    label,
    class: className
  }: { name: string; label?: string; class?: string } = $props();

  // a catalogue Lucide name, or a legacy Heroicons one through its map
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
