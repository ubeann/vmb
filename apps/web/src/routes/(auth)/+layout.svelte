<!--
  The signed-out pages share this layout, so moving between them keeps the
  frame and its artwork mounted: only the sheet's contents change, with a short
  transition (see card-transition.ts). Each page renders an AuthCard.
-->
<script lang="ts">
  import { afterNavigate, onNavigate } from "$app/navigation";
  import AuthShell from "$lib/components/AuthShell.svelte";
  import { betweenAuthPages, transitionNavigation } from "$lib/card-transition.js";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  onNavigate((navigation) => {
    if (betweenAuthPages(navigation)) return transitionNavigation(navigation);
  });

  // SvelteKit's route announcer reads the new page title; focus goes to the new
  // heading as well, so keyboard and screen reader users start at the top of
  // the card rather than on the link they followed, which is gone.
  afterNavigate((navigation) => {
    if (betweenAuthPages(navigation)) document.getElementById("auth-heading")?.focus();
  });
</script>

<AuthShell>{@render children()}</AuthShell>
