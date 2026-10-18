<!--
  The dashboard (#167): a first pass. Who is signed in, their division, whether
  the API is up, and a way into each master screen. The widgets that make it a
  working dashboard come with the domains that feed them.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import RecordIcon from "$lib/components/RecordIcon.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { canOpen, NAV_GROUPS, visibleGroups } from "$lib/nav.js";
  import { pageTitle } from "$lib/page-meta.js";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Building2 from "@lucide/svelte/icons/building-2";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import LockKeyhole from "@lucide/svelte/icons/lock-keyhole";
  import Users from "@lucide/svelte/icons/users";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  const firstName = $derived(data.user?.name.split(/\s+/)[0] ?? "");

  const LINKS = [
    {
      label: "Divisions",
      href: "/master/divisions",
      icon: Building2,
      description: "Organisational units that group users, warehouse items and expense budgets."
    },
    {
      label: "Roles",
      href: "/master/roles",
      icon: KeyRound,
      description: "Named bundles of permissions granted to users."
    },
    {
      label: "Users",
      href: "/master/users",
      icon: Users,
      description: "The people who sign in to VMB."
    }
  ] as const;

  // the screens the caller may open, by the same rule as the sidebar
  const opens = $derived(
    visibleGroups(NAV_GROUPS, canOpen(data.permissions)).flatMap((group) =>
      group.items.map((item) => item.href)
    )
  );
  const links = $derived(LINKS.filter((link) => opens.includes(link.href)));

  const captionClass = "text-muted-foreground text-sm";
</script>

<svelte:head>
  <title>{pageTitle("Dashboard")}</title>
</svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-8">
  <header class="flex flex-col gap-1">
    <h1 class="font-display text-3xl font-medium tracking-tight sm:text-4xl">Hello, {firstName}</h1>
    <p class="text-muted-foreground">Here is where you stand in VMB today.</p>
  </header>

  <section aria-label="Overview" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    <Card.Root>
      <Card.Content class="flex flex-col gap-3">
        <p class={captionClass}>Signed in as</p>
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-lg font-medium">{data.user?.name}</span>
          <span class="text-muted-foreground truncate text-sm">{data.user?.email}</span>
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Content class="flex flex-col gap-3">
        <p class={captionClass}>Division</p>
        <div class="flex min-w-0 items-center gap-2 text-lg font-medium">
          {#if data.division}
            <RecordIcon name={data.division.iconName} class="size-5 shrink-0" />
            <span class="truncate">{data.division.name}</span>
          {:else}
            <span class="text-muted-foreground">No division</span>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root class="sm:col-span-2 xl:col-span-1">
      <Card.Content class="flex flex-col gap-3">
        <p class={captionClass}>System status</p>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt class="text-muted-foreground">API</dt>
          <dd class={data.health.status === "ok" ? "font-medium" : "text-destructive font-medium"}>
            {data.health.status}
          </dd>
          <dt class="text-muted-foreground">Database</dt>
          <dd
            class={data.health.db === "connected" ? "font-medium" : "text-destructive font-medium"}
          >
            {data.health.db}
          </dd>
        </dl>
      </Card.Content>
    </Card.Root>
  </section>

  {#if links.length === 0}
    <div class="bg-card rounded-xl border">
      <EmptyState
        icon={LockKeyhole}
        headingLevel={2}
        title="No screens to open yet"
        description="Your account holds no role that opens a screen. Ask an administrator to give you a role."
      />
    </div>
  {:else}
    <section aria-labelledby="quick-links" class="flex flex-col gap-4">
      <h2 id="quick-links" class="text-lg font-medium">Quick links</h2>
      <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {#each links as link (link.href)}
          <li>
            <a
              href={resolve(link.href)}
              class="group focus-visible:ring-ring block h-full rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              <Card.Root class="group-hover:bg-accent h-full transition-colors">
                <Card.Content class="flex flex-col gap-3">
                  <span class="flex items-center justify-between">
                    <span
                      class="bg-muted text-foreground flex size-9 items-center justify-center rounded-lg"
                    >
                      <link.icon class="size-4" aria-hidden="true" />
                    </span>
                    <ArrowRight
                      class="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                  <span class="flex flex-col gap-1">
                    <span class="font-medium">{link.label}</span>
                    <span class="text-muted-foreground text-sm">{link.description}</span>
                  </span>
                </Card.Content>
              </Card.Root>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>
