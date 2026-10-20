<script lang="ts">
  import { page } from "$app/state";
  import { ArrowUpRight } from "@lucide/svelte";
  import GuideShell from "$lib/components/guides/GuideShell.svelte";

  const missing = $derived(page.status === 404);
</script>

<svelte:head>
  <title>{missing ? "Page not found" : "Something went wrong"} — PhoneMockup</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<GuideShell>
  <section class="g-hub-head g-error wrap" aria-labelledby="error-title">
    <h1 id="error-title">
      {missing ? "This page isn’t here." : "Something went wrong."}
    </h1>
    <div>
      <p>
        {missing
          ? "The link may be old, or the address has a typo. The studio and the guides are a click away."
          : "Reload the page in a moment. Projects saved in this browser are still there."}
      </p>
      <div class="g-actions">
        <a class="button primary" href="/platform/animation/soft-orbit"
          >Make a mockup <ArrowUpRight size={20} /></a
        >
        <a class="text-link" href="/">Home page <ArrowUpRight size={16} /></a>
      </div>
    </div>
  </section>
</GuideShell>
