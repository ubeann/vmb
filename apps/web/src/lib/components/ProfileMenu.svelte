<!--
  The signed-in user's menu, at the right of the top bar (#167): who they are,
  their division, the theme choice and sign-out. Account settings, and the role
  beside the division, join it when those screens and #8's role assignments exist.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import HeroIcon from "$lib/components/HeroIcon.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Monitor from "@lucide/svelte/icons/monitor";
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";
  import { resetMode, setMode, userPrefersMode } from "mode-watcher";

  let {
    user,
    division
  }: {
    user: { id: string; name: string; email: string; image?: string | null };
    division: { name: string; iconName: string } | null;
  } = $props();

  const divisionName = $derived(division?.name ?? "No division");

  function chooseTheme(value: string) {
    if (value === "light" || value === "dark") setMode(value);
    else resetMode();
  }

  const THEMES = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon }
  ] as const;
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="ghost"
        aria-label="{user.name}, {divisionName}, account menu"
        class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-expanded:bg-sidebar-accent h-auto gap-2.5 rounded-full p-1 sm:h-12 sm:rounded-xl sm:py-0 sm:pr-3 sm:pl-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
      >
        <UserAvatar seed={user.id} image={user.image} />
        <span class="hidden min-w-0 text-left leading-tight sm:grid">
          <span class="max-w-40 truncate text-sm font-medium">{user.name}</span>
          <span class="text-sidebar-foreground/70 max-w-40 truncate text-xs font-normal">
            {divisionName}
          </span>
        </span>
        <ChevronDown class="text-sidebar-foreground/70 hidden size-4 sm:block" aria-hidden="true" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Content align="end" class="w-72 max-w-[calc(100vw-1rem)] p-2">
    <div class="flex items-center gap-3 px-1 py-1.5">
      <UserAvatar seed={user.id} image={user.image} size="lg" animated />
      <div class="grid min-w-0 leading-tight">
        <span class="truncate text-sm font-medium">{user.name}</span>
        <span class="text-muted-foreground truncate text-xs">{user.email}</span>
      </div>
    </div>

    <div class="flex items-center gap-3 px-1 py-1.5">
      <span class="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
        {#if division}
          <HeroIcon name={division.iconName} class="size-5" />
        {/if}
      </span>
      <div class="grid min-w-0 leading-tight">
        <span class="text-muted-foreground text-xs">Division</span>
        <span class="truncate text-sm font-medium">{divisionName}</span>
      </div>
    </div>

    <DropdownMenu.Separator class="-mx-2 my-2" />

    <p class="text-muted-foreground px-1 pb-1.5 text-xs font-medium">Theme</p>
    <DropdownMenu.RadioGroup
      value={userPrefersMode.current}
      onValueChange={chooseTheme}
      class="bg-muted flex gap-1 rounded-lg p-1 pointer-coarse:p-0.5"
    >
      {#each THEMES as theme (theme.value)}
        <DropdownMenu.RadioItem
          value={theme.value}
          closeOnSelect={false}
          aria-label={theme.label}
          class="data-[state=checked]:bg-background data-[state=checked]:text-foreground text-muted-foreground min-h-8 flex-1 justify-center rounded-md px-0 py-1.5 data-[state=checked]:shadow-sm pointer-coarse:min-h-11 [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
        >
          <theme.icon aria-hidden="true" />
        </DropdownMenu.RadioItem>
      {/each}
    </DropdownMenu.RadioGroup>

    <DropdownMenu.Separator class="-mx-2 my-2" />

    <form method="POST" action={resolve("/logout")}>
      <DropdownMenu.Item variant="destructive" class="py-2 pointer-coarse:min-h-11">
        {#snippet child({ props })}
          <button {...props} type="submit" class={[props.class, "w-full"]}>
            <LogOut aria-hidden="true" />
            Log out
          </button>
        {/snippet}
      </DropdownMenu.Item>
    </form>
  </DropdownMenu.Content>
</DropdownMenu.Root>
