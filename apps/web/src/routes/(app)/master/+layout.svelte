<script lang="ts">
  let { children } = $props();
</script>

<svelte:head>
  <title>Master — VMB</title>
</svelte:head>

{@render children()}
