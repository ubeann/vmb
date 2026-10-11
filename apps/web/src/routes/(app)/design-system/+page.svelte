<script lang="ts">
  import HeroIcon from "$lib/components/HeroIcon.svelte";
  import Notice from "$lib/components/Notice.svelte";
  import StatusPill from "$lib/components/StatusPill.svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { toast } from "svelte-sonner";
  import AnimatedIconsDemo from "./AnimatedIconsDemo.svelte";
  import DateRangeDemo from "./DateRangeDemo.svelte";
  import DemoForm from "./DemoForm.svelte";
  import LayerDemo from "./LayerDemo.svelte";
  import MotionDemo from "./MotionDemo.svelte";
  import MotionTokens from "./MotionTokens.svelte";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  let confirmOpen = $state(false);

  const TOKENS = [
    { name: "background", swatch: "bg-background", text: "text-foreground" },
    { name: "card", swatch: "bg-card", text: "text-card-foreground" },
    { name: "primary", swatch: "bg-primary", text: "text-primary-foreground" },
    { name: "secondary", swatch: "bg-secondary", text: "text-secondary-foreground" },
    { name: "muted", swatch: "bg-muted", text: "text-muted-foreground" },
    { name: "accent", swatch: "bg-accent", text: "text-accent-foreground" },
    { name: "destructive", swatch: "bg-destructive", text: "text-background" },
    { name: "success", swatch: "bg-success", text: "text-background" },
    { name: "warning", swatch: "bg-warning", text: "text-background" },
    { name: "border", swatch: "bg-border", text: "text-foreground" }
  ];

  const NOTICES = [
    { variant: "destructive", text: "Unable to reach the server. Try again in a moment." },
    { variant: "success", text: "Your password is set. You can log in with it now." },
    { variant: "default", text: "Codes expire after ten minutes." }
  ] as const;

  const BUTTON_VARIANTS = [
    "default",
    "secondary",
    "outline",
    "ghost",
    "destructive",
    "link"
  ] as const;

  const DIVISIONS = [
    { code: "OPS", name: "Operations", icon: "heroicon-o-cog-6-tooth", members: 14, active: true },
    { code: "FIN", name: "Finance", icon: "heroicon-o-banknotes", members: 6, active: true },
    { code: "TRK", name: "Trucking", icon: "heroicon-o-truck", members: 128, active: true },
    { code: "WHS", name: "Warehouse", icon: "heroicon-o-cube", members: 42, active: false }
  ];

  const ICON_NAMES = [
    "heroicon-o-banknotes",
    "heroicon-o-building-office",
    "heroicon-o-building-office-2",
    "heroicon-o-clipboard-document-check",
    "heroicon-o-cog",
    "heroicon-o-cog-6-tooth",
    "heroicon-o-computer-desktop",
    "heroicon-o-cube",
    "heroicon-o-home",
    "heroicon-o-megaphone",
    "heroicon-o-rocket-launch",
    "heroicon-o-scale",
    "heroicon-o-shield-check",
    "heroicon-o-shopping-cart",
    "heroicon-o-truck",
    "heroicon-o-user",
    "heroicon-o-user-group",
    "heroicon-o-academic-cap"
  ];
</script>

<svelte:head>
  <title>Design system — VMB</title>
</svelte:head>

{#snippet section(id: string, title: string, description: string)}
  <div class="space-y-1">
    <h2 {id} class="text-lg font-semibold tracking-tight">{title}</h2>
    <p class="text-muted-foreground text-sm">{description}</p>
  </div>
{/snippet}

<div class="mx-auto max-w-6xl space-y-12 p-6">
  <header class="space-y-2">
    <h1 class="text-3xl font-bold tracking-tight">Design system</h1>
    <p class="text-muted-foreground max-w-prose">
      The primitives every VMB screen composes from: tokens, controls, and the VMB-specific pieces.
      The rules behind them are in ADR-0035.
    </p>
  </header>

  <section class="space-y-4" aria-labelledby="tokens">
    {@render section(
      "tokens",
      "Colour tokens",
      "Semantic only. No raw hex or palette classes in pages."
    )}
    <ul class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {#each TOKENS as token (token.name)}
        <li class="overflow-hidden rounded-lg border">
          <div class="flex h-16 items-end p-2 text-xs font-medium {token.swatch} {token.text}">
            Aa
          </div>
          <div class="p-2 font-mono text-xs">--{token.name}</div>
        </li>
      {/each}
    </ul>
  </section>

  <section class="space-y-4" aria-labelledby="type">
    {@render section(
      "type",
      "Typography",
      "Schibsted Grotesk for UI text, Newsreader for display headings, JetBrains Mono for codes and figures (ADR-0046); numbers in data columns use tabular figures."
    )}
    <div class="space-y-2">
      <p class="font-display text-3xl font-medium tracking-tight">
        Display heading · Newsreader 30/medium
      </p>
      <p class="text-3xl font-bold tracking-tight">Page title · 30/bold</p>
      <p class="text-lg font-semibold">Section title · 18/semibold</p>
      <p>Body text · 16/regular, line-height 1.5</p>
      <p class="text-muted-foreground text-sm">Supporting text · 14/muted</p>
      <div class="flex gap-8 text-sm">
        <div>
          <div class="text-muted-foreground text-xs">proportional</div>
          <div>1,111<br />8,888</div>
        </div>
        <div class="tabular-nums">
          <div class="text-muted-foreground text-xs">tabular-nums</div>
          <div>1,111<br />8,888</div>
        </div>
        <div class="font-mono">
          <div class="text-muted-foreground font-sans text-xs">font-mono</div>
          <div>WH-0011<br />482915</div>
        </div>
      </div>
    </div>
  </section>

  <section class="space-y-4" aria-labelledby="buttons">
    {@render section(
      "buttons",
      "Buttons",
      "One primary action per view; destructive actions confirm in a dialog."
    )}
    <div class="flex flex-wrap items-center gap-3">
      {#each BUTTON_VARIANTS as variant (variant)}
        <Button {variant}>{variant}</Button>
      {/each}
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
      <Button><PlusIcon data-icon="inline-start" />New division</Button>
      <Button variant="outline" size="icon" aria-label="Add"><PlusIcon /></Button>
      <Button disabled>Disabled</Button>
    </div>
  </section>

  <section class="space-y-4" aria-labelledby="badges">
    {@render section("badges", "Badges", "Status is text plus tone, never colour alone.")}
    <div class="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
    </div>
  </section>

  <section class="space-y-4" aria-labelledby="alerts">
    {@render section(
      "alerts",
      "Alerts",
      "A tinted fill, an icon and text. Errors are announced as alerts, notices as status."
    )}
    <div class="grid max-w-xl gap-3">
      {#each NOTICES as { variant, text } (variant)}
        <Notice {variant}>{text}</Notice>
      {/each}
    </div>
  </section>

  <section class="space-y-4" aria-labelledby="forms">
    {@render section(
      "forms",
      "Forms",
      "Formsnap + Superforms: visible labels, errors under the field. Submit empty to see them."
    )}
    <Card.Root>
      <Card.Header>
        <Card.Title>New division</Card.Title>
        <Card.Description>Validated on the client and again by the form action.</Card.Description>
      </Card.Header>
      <Card.Content>
        <DemoForm data={data.form} />
      </Card.Content>
    </Card.Root>
    <div class="grid max-w-sm gap-2">
      <Label for="invalid-demo">Invalid state</Label>
      <Input
        id="invalid-demo"
        value="x"
        aria-invalid="true"
        aria-describedby="invalid-demo-error"
      />
      <p id="invalid-demo-error" class="text-destructive text-sm">
        Name needs at least 3 characters
      </p>
    </div>
  </section>

  <section class="space-y-4" aria-labelledby="tables">
    {@render section(
      "tables",
      "Tables",
      "Codes and counts right-aligned in tabular figures; the wrapper scrolls on narrow screens."
    )}
    <div class="rounded-lg border">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Code</Table.Head>
            <Table.Head>Division</Table.Head>
            <Table.Head class="text-right">Members</Table.Head>
            <Table.Head>Status</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each DIVISIONS as division (division.code)}
            <Table.Row>
              <Table.Cell class="font-mono">{division.code}</Table.Cell>
              <Table.Cell>
                <span class="inline-flex items-center gap-2">
                  <HeroIcon name={division.icon} class="text-muted-foreground size-4" />
                  {division.name}
                </span>
              </Table.Cell>
              <Table.Cell class="text-right tabular-nums">{division.members}</Table.Cell>
              <Table.Cell>
                <StatusPill status={division.active ? "Active" : "Inactive"} />
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  </section>

  <section class="space-y-4" aria-labelledby="overlays">
    {@render section(
      "overlays",
      "Dialogs, popovers and toasts",
      "Confirm destructive actions; pick a value in a popover; report outcomes with a toast."
    )}
    <div class="flex flex-wrap gap-3">
      <Dialog.Root bind:open={confirmOpen}>
        <Dialog.Trigger>
          {#snippet child({ props })}
            <Button {...props} data-slot="button" variant="destructive"
              ><Trash2Icon data-icon="inline-start" />Delete division</Button
            >
          {/snippet}
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Delete Operations?</Dialog.Title>
            <Dialog.Description>
              The division is soft-deleted and can be restored from the trash.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Dialog.Close>
              {#snippet child({ props })}
                <Button {...props} data-slot="button" variant="outline">Cancel</Button>
              {/snippet}
            </Dialog.Close>
            <Button
              variant="destructive"
              onclick={() => {
                confirmOpen = false;
                toast.success("Operations deleted");
              }}>Delete</Button
            >
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
      <Button variant="outline" onclick={() => toast.success("Division saved")}
        >Success toast</Button
      >
      <Button variant="outline" onclick={() => toast.error("Could not reach the API")}
        >Error toast</Button
      >
      <Button variant="outline" onclick={() => toast.info("3 users imported")}>Info toast</Button>
      <DateRangeDemo />
    </div>
  </section>

  <section class="space-y-4" aria-labelledby="layers">
    {@render section(
      "layers",
      "Layers",
      "A list's panels: a sheet on phones, a dialog to 639px, the panel by its button from 640px; steps open beside it where there's room."
    )}
    <LayerDemo />
  </section>

  <section class="space-y-4" aria-labelledby="motion-tokens">
    {@render section(
      "motion-tokens",
      "Motion tokens",
      "Durations and easings come from these tokens in app.css, never literals (ADR-0040)."
    )}
    <MotionTokens />
  </section>

  <section class="space-y-4" aria-labelledby="motion">
    {@render section(
      "motion",
      "Reduced motion",
      "CSS motion collapses globally; Svelte transitions gate on prefersReducedMotion themselves."
    )}
    <MotionDemo />
  </section>

  <section class="space-y-4" aria-labelledby="icons">
    {@render section(
      "icons",
      "Division and role icons",
      "Stored Heroicons names drawn as Lucide glyphs; unmapped names fall back."
    )}
    <ul class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {#each ICON_NAMES as name (name)}
        <li class="flex items-center gap-2 rounded-md border p-2 text-xs">
          <HeroIcon {name} class="text-primary size-5 shrink-0" />
          <span class="truncate font-mono">{name}</span>
        </li>
      {/each}
    </ul>
  </section>

  <section class="space-y-4" aria-labelledby="animated-icons">
    {@render section(
      "animated-icons",
      "Animated feedback icons",
      "Vendored moving icons (ADR-0035 rule 3), used only for state changes, never decoration."
    )}
    <AnimatedIconsDemo />
  </section>

  <section class="space-y-4" aria-labelledby="dark">
    {@render section(
      "dark",
      "Dark tokens",
      "A .dark subtree. The toggle lives in the account menu of the app shell (#167)."
    )}
    <div class="dark bg-background text-foreground space-y-4 rounded-xl border p-6">
      <div class="flex flex-wrap gap-3">
        {#each BUTTON_VARIANTS as variant (variant)}
          <Button {variant}>{variant}</Button>
        {/each}
      </div>
      <div class="flex flex-wrap gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </div>
      <div class="grid max-w-xl gap-3">
        {#each NOTICES as { variant, text } (variant)}
          <Notice {variant}>{text}</Notice>
        {/each}
      </div>
      <Card.Root class="max-w-sm">
        <Card.Header>
          <Card.Title>Card on dark</Card.Title>
          <Card.Description>Muted text keeps 4.5:1 here too.</Card.Description>
        </Card.Header>
        <Card.Content class="grid gap-2">
          <Label for="dark-input">Name</Label>
          <Input id="dark-input" placeholder="Operations" />
        </Card.Content>
      </Card.Root>
    </div>
  </section>
</div>
