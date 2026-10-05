<!--
  A person's picture: their uploaded photo when there is one, their generated
  Pixelbot until it loads or when it fails. The bot comes in a light and a dark
  version, and the theme class on <html> picks which one shows, so a theme
  change needs no script. Decorative, since the name always sits beside it.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import * as Avatar from "$lib/components/ui/avatar/index.js";

  let {
    seed,
    image = null,
    animated = false,
    size = "default",
    class: className
  }: {
    // Who the picture is for; the user's id, so a rename doesn't change it.
    seed: string;
    image?: string | null;
    animated?: boolean;
    size?: "default" | "sm" | "lg";
    class?: string;
  } = $props();

  const bot = (theme: "light" | "dark") =>
    `${resolve("/(app)/avatar/[seed]", { seed })}?theme=${theme}${animated ? "&animated=1" : ""}`;
</script>

<Avatar.Root {size} class={className}>
  {#if image}
    <Avatar.Image src={image} alt="" />
  {/if}
  <Avatar.Fallback class="bg-muted">
    <img src={bot("light")} alt="" loading="lazy" class="size-full rounded-full dark:hidden" />
    <img src={bot("dark")} alt="" loading="lazy" class="hidden size-full rounded-full dark:block" />
  </Avatar.Fallback>
</Avatar.Root>
