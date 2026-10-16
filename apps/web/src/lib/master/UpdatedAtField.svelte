<script lang="ts">
  import Notice from "$lib/components/Notice.svelte";
  import { plainClick } from "$lib/components/list/rows.js";

  let {
    value,
    error,
    reloadHref,
    onreload
  }: {
    /** The stamp the editor loaded, posted back for the API to check. */
    value: string | null;
    /** What the API said about the stamp: set when the record changed since. */
    error?: string[];
    /** The edit page itself, which a full load shows as it is now. */
    reloadHref: string;
    /** In the layer over the list: loads the record again there, keeping the list. */
    onreload?: () => void;
  } = $props();
</script>

<input type="hidden" name="updatedAt" value={value ?? ""} />

{#if error?.length}
  <Notice variant="destructive">
    Someone else changed this record since you opened it. Nothing was saved and your changes are
    kept here.
    <!-- eslint-disable svelte/no-navigation-without-resolve -- the page passes a resolve()d path -->
    <a
      href={reloadHref}
      data-sveltekit-reload
      onclick={(event) => {
        if (!onreload || !plainClick(event)) return;
        event.preventDefault();
        onreload();
      }}
      class="font-medium underline underline-offset-2">Reload</a
    >
    to see the latest, then save again.
  </Notice>
{/if}
