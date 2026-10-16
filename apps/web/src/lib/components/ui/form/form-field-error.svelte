<!--
  One error under a field: a warning mark before the message, so the error is
  told by more than its colour. The label above stays its own colour (#302);
  the field's edge and this line carry the error.
-->
<script lang="ts">
  import { cn } from "$lib/utils.js";
  import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
  import type { HTMLAttributes } from "svelte/elements";

  let { class: className, children, ...rest }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div data-slot="form-field-error" class={cn("flex items-start gap-1", className)} {...rest}>
  <!-- one line tall, so the mark sits on the first line of a message that wraps -->
  <span class="flex h-lh shrink-0 items-center" aria-hidden="true">
    <CircleAlertIcon class="size-[1.1em]" />
  </span>
  <span>{@render children?.()}</span>
</div>
