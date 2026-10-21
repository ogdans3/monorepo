<script lang="ts">
  import "../app.css";
  import "$lib/components/library/overlays.css";
  import favicon from "$lib/assets/favicon.png";
  import { Toaster } from "$lib/components/ui/sonner";
  import { page } from "$app/state";
  import { initializeAuth } from "$lib/auth/clerk.svelte";

  let { children, data } = $props();

  // Clerk is some 570 KB of script and five third-party requests. The
  // landing page and the guides need it only to show the avatar of someone
  // already signed in (Clerk's __client_uat cookie is then not "0"); signed
  // out, they show the same Sign in links without it.
  function signedIn() {
    return /(?:^|;\s*)__client_uat(?:_[^=]*)?=(?!0(?:;|$))[^;]+/.test(document.cookie);
  }
  $effect(() => {
    if (/^\/(sign-in|sign-up|platform)(\/|$)/.test(page.url.pathname) || signedIn()) {
      void initializeAuth(data.clerkPublishableKey);
    }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</svelte:head>

{@render children?.()}
<Toaster richColors />
