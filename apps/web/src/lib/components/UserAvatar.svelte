<!--
  A person's picture: their uploaded photo when there is one, their generated
  initials until it loads or when it fails. Decorative, since the name always
  sits beside it.
-->
<script lang="ts">
  import * as Avatar from "$lib/components/ui/avatar/index.js";
  import { placeholderAvatar } from "$lib/avatar.js";

  let {
    name,
    image = null,
    size = "default",
    class: className
  }: {
    name: string;
    image?: string | null;
    size?: "default" | "sm" | "lg";
    class?: string;
  } = $props();
</script>

<Avatar.Root {size} class={className}>
  {#if image}
    <Avatar.Image src={image} alt="" />
  {/if}
  <Avatar.Fallback class="bg-transparent">
    <img src={placeholderAvatar(name)} alt="" class="size-full rounded-full" />
  </Avatar.Fallback>
</Avatar.Root>
