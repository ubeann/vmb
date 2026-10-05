<script lang="ts">
  import DivisionForm from "$lib/master/DivisionForm.svelte";
  import { resolve } from "$app/paths";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Edit division — VMB</title>
</svelte:head>

<h2>Edit division</h2>

<DivisionForm form={data.form} />

<p>
  <a href={resolve("/(app)/master/divisions/[id]", { id: data.division.id })}>Back to division</a>
</p>
