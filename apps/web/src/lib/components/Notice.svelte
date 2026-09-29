<script lang="ts" module>
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Info from "@lucide/svelte/icons/info";

  export type NoticeVariant = "default" | "destructive" | "success";

  // One row per variant: its tint (each from its own token, ADR-0036), icon and
  // live-region role. Errors interrupt (`alert`); notices wait their turn (`status`).
  // The text stays on `foreground` for notices so its contrast doesn't depend on the tint.
  const VARIANTS = {
    destructive: {
      icon: CircleAlert,
      role: "alert",
      class: "border-destructive/30 bg-destructive/10 text-destructive"
    },
    success: {
      icon: CircleCheck,
      role: "status",
      class: "border-primary/30 bg-primary/10 text-foreground *:[svg]:text-primary"
    },
    default: {
      icon: Info,
      role: "status",
      class: "border-foreground/30 bg-foreground/10 text-foreground"
    }
  } as const;
</script>

<script lang="ts">
  import { Alert, AlertDescription } from "$lib/components/ui/alert/index.js";
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    variant = "default",
    class: className,
    children,
    ...restProps
  }: Omit<HTMLAttributes<HTMLDivElement>, "role"> & {
    variant?: NoticeVariant;
    children?: Snippet;
  } = $props();

  const { icon: Icon, role, class: tint } = $derived(VARIANTS[variant]);
</script>

<!-- The registry's own variants stay untouched (ADR-0035 rule 2): the tint rides on `class`. -->
<Alert {...restProps} {role} class={cn(tint, className)}>
  <Icon aria-hidden="true" />
  <AlertDescription class="text-current">{@render children?.()}</AlertDescription>
</Alert>
