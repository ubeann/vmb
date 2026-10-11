<script lang="ts">
  import { useShortcuts } from "$lib/components/shortcuts.svelte.js";
  import StarIcon from "@lucide/svelte/icons/star";

  useShortcuts(() => [
    {
      title: "On the test page",
      icon: StarIcon,
      rows: [{ keys: ["X"], what: "Do the test thing" }]
    }
  ]);
</script>

<p>A page that adds a section</p>
