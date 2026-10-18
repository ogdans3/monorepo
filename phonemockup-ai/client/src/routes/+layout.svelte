<script lang="ts">
  import "../app.css";
  import "$lib/components/library/overlays.css";
  import favicon from "$lib/assets/favicon.png";
  import { Toaster } from "$lib/components/ui/sonner";
  import { onMount } from "svelte";
  import { initializeAuth } from "$lib/auth/clerk.svelte";

  let { children, data } = $props();
  onMount(() => {
    void initializeAuth(data.clerkPublishableKey);
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
<Toaster richColors />
