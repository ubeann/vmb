<script lang="ts">
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<h1>VMB</h1>

<p>
  API status:
  <strong>{data.health.status}</strong>
  (db: {data.health.db})
</p>
