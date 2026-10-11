<script lang="ts">
  let {
    value,
    error,
    reloadHref
  }: {
    /** The stamp the editor loaded, posted back for the API to check. */
    value: string | null;
    /** What the API said about the stamp: set when the record changed since. */
    error?: string[];
    /** The edit page itself, which a full load shows as it is now. */
    reloadHref: string;
  } = $props();
</script>

<input type="hidden" name="updatedAt" value={value ?? ""} />

{#if error?.length}
  <p class="error" role="alert">
    Someone else changed this record since you opened it. Nothing was saved and your changes are
    kept here.
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the page passes a resolve()d path -->
    <a href={reloadHref} data-sveltekit-reload>Reload</a>
    to see the latest, then save again.
  </p>
{/if}
