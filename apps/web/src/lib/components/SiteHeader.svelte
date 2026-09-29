<!--
  The masthead of the signed-out pages (AuthShell, the error page): the VMB
  logo, the three domains and the theme menu.
-->
<script lang="ts">
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import VmbLogo from "$lib/components/VmbLogo.svelte";
</script>

<header
  class="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 pt-6 sm:px-10 lg:px-16 lg:pt-10"
>
  <VmbLogo class="h-10 sm:h-11" />
  <div class="flex items-center gap-4 sm:gap-6">
    <p class="text-muted-foreground hidden text-xs font-medium tracking-[0.2em] uppercase sm:block">
      Warehouse · Trucking · Expense
    </p>
    <ThemeToggle class="-mr-2" />
  </div>
</header>
