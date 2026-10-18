<script lang="ts">
  import { onMount, type Snippet } from "svelte";
  import AuthControls from "$lib/components/auth/AuthControls.svelte";
  import "./library.css";
  let {
    active,
    children,
  }: { active: "projects" | "motions"; children: Snippet } = $props();
  onMount(() => {
    const dark = document.body.classList.contains("dark");
    document.body.classList.remove("dark");
    document.body.classList.add("library-theme");
    return () => {
      document.body.classList.remove("library-theme");
      if (dark) document.body.classList.add("dark");
    };
  });
</script>

<div class="library-theme library-shell">
  <a class="library-skip" href="#library-main">Skip to content</a>
  <header class="library-header">
    <a class="library-brand" href="/" aria-label="PhoneMockup home"
      >phonemockup<span aria-hidden="true">.</span></a
    >
    <nav aria-label="Workspace navigation">
      <a
        href="/platform/project"
        aria-current={active === "projects" ? "page" : undefined}>My projects</a
      >
      <a
        href="/platform/animation"
        aria-current={active === "motions" ? "page" : undefined}
        >Motion library</a
      >
    </nav>
    <div class="library-account"><AuthControls compact /></div>
  </header>
  <main id="library-main" class="library-main" tabindex="-1">
    {@render children()}
  </main>
  <footer class="library-footer">
    <a href="/">PhoneMockup</a><span>Made for work worth showing.</span>
  </footer>
</div>
