<script lang="ts">
  import DivisionForm from "$lib/master/DivisionForm.svelte";
  import { resolve } from "$app/paths";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>New division — VMB</title>
</svelte:head>

<h2>New division</h2>

<DivisionForm form={data.form} submitLabel="Create division" />

<p><a href={resolve("/master/divisions")}>Back to divisions</a></p>
