<!--
  The signed-in person's own profile (#458), reached from the account menu:
  their name, phone and photo link, and the email read-only. Saving redirects
  back here with `?saved`, which says so and, through the layout's reload,
  gives the shell the new name and picture without signing out again.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import Notice from "$lib/components/Notice.svelte";
  import Page from "$lib/components/Page.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ProfileForm from "$lib/profile/ProfileForm.svelte";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Profile — VMB</title>
</svelte:head>

<Page width="narrow" class="flex flex-col gap-4">
  <PageHeader title="Profile" description="Your name, phone number and photo." />

  {#if data.saved}
    <Notice variant="success">Your profile is saved.</Notice>
  {/if}

  <div class="bg-background flex flex-col overflow-hidden rounded-xl border pt-3">
    {#key data.stamp}
      <ProfileForm form={data.form} email={data.email} cancelHref={resolve("/")} />
    {/key}
  </div>
</Page>
