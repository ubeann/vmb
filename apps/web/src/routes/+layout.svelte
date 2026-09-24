<script lang="ts">
  import "../app.css";
  import { resolve } from "$app/paths";
  import type { Snippet } from "svelte";
  import type { LayoutData } from "./$types.js";

  let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

{#if data.user}
  <nav>
    <a href={resolve("/")}>VMB</a>
    <a href={resolve("/master")}>Master</a>

    <form method="POST" action={resolve("/logout")}>
      <button type="submit">Log out</button>
    </form>
  </nav>
{/if}

{@render children()}
