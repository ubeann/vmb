<script lang="ts" module>
  /** The tones a status can take; each is a token pair in app.css (ADR-0036, "Status tones"). */
  export type Tone = "success" | "warning" | "neutral";

  /**
   * Every status a list shows, and its tone, in one place so the same word
   * always reads the same way. Status is text plus tone, never colour alone
   * (ADR-0035 rule 5).
   */
  export const STATUS_TONES = {
    Active: "success",
    Suspended: "warning",
    Inactive: "neutral"
  } as const satisfies Record<string, Tone>;

  export type Status = keyof typeof STATUS_TONES;

  const TONE_CLASSES: Record<Tone, string> = {
    success: "border-success/30 bg-success/12 text-success",
    warning: "border-warning/30 bg-warning/12 text-warning",
    neutral: "border-border bg-muted text-muted-foreground"
  };
</script>

<script lang="ts">
  import { cn } from "$lib/utils.js";

  let { status, class: className }: { status: Status; class?: string } = $props();

  const tone = $derived(STATUS_TONES[status]);
</script>

<span
  data-tone={tone}
  class={cn(
    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
    TONE_CLASSES[tone],
    className
  )}
>
  <span aria-hidden="true" class="size-1.5 rounded-full bg-current"></span>{status}
</span>
