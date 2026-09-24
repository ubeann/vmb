<script lang="ts">
  import * as Form from "$lib/components/ui/form/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { toast } from "svelte-sonner";
  import { superForm, type SuperValidated } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";
  import type { z } from "zod";
  import { DEMO_DIVISIONS, DemoSchema } from "./schema.js";

  let { data }: { data: SuperValidated<z.infer<typeof DemoSchema>> } = $props();

  // svelte-ignore state_referenced_locally
  const form = superForm(data, {
    validators: zod4Client(DemoSchema),
    onUpdated: ({ form }) => {
      if (form.message) toast.success(form.message);
    }
  });
  const { form: formData, enhance, submitting } = form;

  const divisionLabel = $derived(
    DEMO_DIVISIONS.find((d) => d.value === $formData.division)?.label ?? "Choose a division"
  );
</script>

<form method="POST" use:enhance class="grid gap-4 sm:grid-cols-2">
  <Form.Field {form} name="name">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Name</Form.Label>
        <Input {...props} bind:value={$formData.name} autocomplete="off" />
      {/snippet}
    </Form.Control>
    <Form.Description>Shown in lists and selects.</Form.Description>
    <Form.FieldErrors />
  </Form.Field>

  <Form.Field {form} name="code">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Code</Form.Label>
        <Input {...props} bind:value={$formData.code} class="font-mono" />
      {/snippet}
    </Form.Control>
    <Form.Description>3–5 uppercase letters.</Form.Description>
    <Form.FieldErrors />
  </Form.Field>

  <Form.Field {form} name="division">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Division</Form.Label>
        <Select.Root type="single" bind:value={$formData.division} name={props.name}>
          <Select.Trigger {...props} class="w-full">{divisionLabel}</Select.Trigger>
          <Select.Content>
            {#each DEMO_DIVISIONS as division (division.value)}
              <Select.Item value={division.value} label={division.label} />
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>

  <div class="flex items-end sm:col-span-2">
    <Form.Button disabled={$submitting}>Save</Form.Button>
  </div>
</form>
