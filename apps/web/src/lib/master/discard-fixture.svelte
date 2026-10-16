<!-- A layer's close checks around a DivisionForm, as the record layer over the list has them. -->
<script lang="ts">
  import { provideCloseChecks } from "$lib/components/form/discard.svelte.js";
  import type { ComponentProps } from "svelte";
  import DivisionForm from "./DivisionForm.svelte";

  let {
    form,
    onanswer
  }: { form: ComponentProps<typeof DivisionForm>["form"]; onanswer: (close: boolean) => void } =
    $props();

  const checks = provideCloseChecks();
</script>

<button type="button" onclick={async () => onanswer(await checks.allow())}>Close layer</button>
<DivisionForm {form} />
