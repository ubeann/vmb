<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { onMount } from "svelte";

  const DURATIONS = [
    { name: "--duration-feedback", use: "A press, a toggled state, a copied value" },
    { name: "--duration-panel", use: "A panel, a toast, the auth card changing contents" },
    { name: "--duration-icon", use: "An icon swapping for another" },
    { name: "--duration-etch-reveal", use: "The etched plate revealing" },
    { name: "--duration-etch-settle", use: "The sky and flock drifting into place" },
    { name: "--delay-etch-plate", use: "Before the plate reveals" },
    { name: "--delay-etch-sky", use: "Before the sky settles" },
    { name: "--delay-etch-flock", use: "Before the flock settles" }
  ];

  const EASINGS = [
    { name: "--easing-standard", utility: "ease-standard", use: "Most UI motion" },
    { name: "--easing-settle", utility: "ease-settle", use: "A long, soft stop" },
    { name: "--easing-reveal", utility: "ease-reveal", use: "A reveal across the plate" },
    { name: "--easing-spring", utility: "ease-spring", use: "A small overshoot, then rest" }
  ];

  // Read from the live stylesheet, so this page can't drift from app.css. A
  // custom property keeps its source formatting, so the multi-line `linear()`
  // is folded onto one line.
  let values = $state<Record<string, string>>({});
  onMount(() => {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) =>
      style
        .getPropertyValue(name)
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\( | \)/g, (m) => m.trim());
    values = Object.fromEntries([...DURATIONS, ...EASINGS].map(({ name }) => [name, read(name)]));
  });

  let played = $state(false);
</script>

<div class="space-y-6">
  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head>Token</Table.Head>
        <Table.Head class="text-right">Value</Table.Head>
        <Table.Head>Use</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each DURATIONS as token (token.name)}
        <Table.Row>
          <Table.Cell class="font-mono text-xs">{token.name}</Table.Cell>
          <Table.Cell class="text-right font-mono text-xs tabular-nums">
            {values[token.name] ?? "…"}
          </Table.Cell>
          <Table.Cell class="text-muted-foreground">{token.use}</Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>

  <div class="space-y-3">
    <Button variant="outline" onclick={() => (played = !played)}>
      {played ? "Reset easings" : "Play easings"}
    </Button>
    <ul class="space-y-3">
      {#each EASINGS as easing (easing.name)}
        <li class="grid gap-1 sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-4">
          <div class="text-sm">
            <span class="font-mono text-xs">{easing.utility}</span>
            <span class="text-muted-foreground"> — {easing.use}</span>
          </div>
          <div class="bg-muted relative h-3 rounded-full">
            <span
              data-testid="easing-dot"
              class={[
                "bg-primary absolute top-0 size-3 rounded-full transition-[left] duration-(--duration-etch-reveal)",
                easing.utility,
                played ? "left-[calc(100%-0.75rem)]" : "left-0"
              ]}
            ></span>
          </div>
          <p class="text-muted-foreground font-mono text-xs break-all sm:col-start-2">
            {values[easing.name] ?? "…"}
          </p>
        </li>
      {/each}
    </ul>
  </div>
</div>
