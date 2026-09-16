<script lang="ts">
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>VMB</title>
</svelte:head>

<h1>VMB</h1>

<p>
  API status:
  <strong>{data.health.status}</strong>
  (db: {data.health.db})
</p>
