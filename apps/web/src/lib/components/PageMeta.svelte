<!--
  A page's <head> metadata: the tab title and description, plus the Open Graph
  and Twitter tags a chat app reads to preview a pasted link. Tag values come
  from `$lib/page-meta.ts`, so every page previews the same way.
-->
<script lang="ts">
  import { page } from "$app/state";
  import { metaKey, metaTags, pageTitle } from "$lib/page-meta.js";

  let { title, description }: { title: string; description: string } = $props();

  let tags = $derived(metaTags({ title, description, url: page.url }));
</script>

<svelte:head>
  <title>{pageTitle(title)}</title>
  {#each tags as tag (metaKey(tag))}
    <meta {...tag} />
  {/each}
</svelte:head>
