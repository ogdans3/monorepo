<script lang="ts">
  import { page } from "$app/state";
  import { auth, getClerk, initializeAuth } from "$lib/auth/clerk.svelte";
  import { safeReturnPath } from "$lib/auth/return-path";

  let { mode }: { mode: "sign-in" | "sign-up" } = $props();
  let mount = $state<HTMLDivElement>();
  const returnPath = $derived(
    safeReturnPath(page.url.searchParams.get("returnTo")),
  );
  const signingUp = $derived(mode === "sign-up");

  $effect(() => {
    if (auth.status !== "ready" || auth.userId || !mount) return;
    const clerk = getClerk();
    if (!clerk) return;
    const node = mount;
    const options = {
      routing: "hash" as const,
      forceRedirectUrl: returnPath,
      signInUrl: `/sign-in?returnTo=${encodeURIComponent(returnPath)}`,
      signUpUrl: `/sign-up?returnTo=${encodeURIComponent(returnPath)}`,
    };
    if (signingUp) {
      clerk.mountSignUp(node, options);
      return () => clerk.unmountSignUp(node);
    }
    clerk.mountSignIn(node, options);
    return () => clerk.unmountSignIn(node);
  });
</script>

<svelte:head
  ><title>{signingUp ? "Create an account" : "Sign in"} — PhoneMockup</title
  ><meta name="robots" content="noindex" /></svelte:head
>

<div class="auth-page">
  <header>
    <a class="wordmark" href="/">phonemockup<span></span></a><a
      class="back"
      href={returnPath}>Back to studio ↗</a
    >
  </header>
  <main>
    <div class="intro">
      <p class="eyebrow">YOUR ACCOUNT</p>
      <h1>{signingUp ? "Make yourself at home." : "Good to see you."}</h1>
      <p>Every device. Every angle. Your next idea.</p>
    </div>
    {#if auth.userId}
      <section class="notice">
        <h2>You’re signed in.</h2>
        <p>Ready when you are.</p>
        <a class="primary" href={returnPath}>Continue to studio ↗</a><button
          type="button"
          onclick={() => getClerk()?.signOut()}>Sign out</button
        >
      </section>
    {:else if auth.status === "loading"}
      <div class="notice" role="status">Loading secure sign-in…</div>
    {:else if auth.status === "error" || auth.status === "unconfigured"}
      <section class="notice" role="status">
        <h2>Sign-in is currently unavailable.</h2>
        <p>You can still create, save and export mockups in this browser.</p>
        {#if auth.status === "error"}<button
            class="primary"
            type="button"
            onclick={() => initializeAuth()}>Try again</button
          >{/if}
        <a href={returnPath}>Continue to studio ↗</a>
      </section>
    {:else}
      <div class="clerk-mount" bind:this={mount}></div>
    {/if}
    <p class="local-note">
      Your mockup projects are saved in this browser.<br />Signing in doesn’t
      upload your files.
    </p>
  </main>
  <footer>Made for work worth showing.</footer>
</div>

<style>
  .auth-page {
    min-height: 100dvh;
    color: #282923;
    background: #f6f5ef;
    font-family: Archivo, sans-serif;
    --background: #fffefa;
    --foreground: #282923;
    --primary: #a3442c;
    --primary-foreground: #fffefa;
    --muted: #f1f0e9;
    --muted-foreground: #6f7066;
    --border: #deded4;
    --input: #deded4;
    --ring: #a3442c;
    --card: #fffefa;
    --card-foreground: #282923;
    --popover: #fffefa;
    --popover-foreground: #282923;
    --radius: 5px;
  }
  header {
    max-width: 1320px;
    margin: auto;
    height: 88px;
    padding: 0 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #deded4;
    gap: 16px;
  }
  .wordmark {
    font-size: 23px;
    font-weight: 600;
    letter-spacing: -1.2px;
    display: flex;
    align-items: baseline;
    gap: 4px;
  }
  .wordmark span {
    width: 7px;
    height: 7px;
    background: #a3442c;
  }
  a {
    text-decoration: none;
  }
  a,
  button {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .back {
    font-size: 13px;
  }
  main {
    width: min(100% - 32px, 440px);
    margin: 64px auto;
  }
  .intro {
    margin-bottom: 28px;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.14em;
    color: #a3442c;
    margin-bottom: 16px;
  }
  h1 {
    font-size: clamp(32px, 7vw, 40px);
    font-weight: 500;
    letter-spacing: -0.055em;
    line-height: 1.05;
    margin-bottom: 16px;
  }
  .intro > p:last-child,
  .notice p {
    font-size: 14px;
    color: #6f7066;
    line-height: 1.6;
  }
  .clerk-mount {
    min-height: 340px;
  }
  .clerk-mount :global(.cl-rootBox),
  .clerk-mount :global(.cl-cardBox) {
    width: 100%;
    max-width: 100%;
  }
  .notice {
    padding: 28px;
    border: 1px solid #deded4;
    border-radius: 5px;
    background: #fffefa;
  }
  .notice h2 {
    font-weight: 500;
    font-size: 18px;
    margin-bottom: 10px;
  }
  .notice a,
  .notice button {
    margin-top: 16px;
    font-size: 13px;
    padding: 0 14px;
    border-radius: 5px;
    cursor: pointer;
  }
  .primary {
    background: #a3442c;
    color: white;
  }
  .local-note {
    text-align: center;
    color: #6f7066;
    font-size: 12px;
    line-height: 1.7;
    margin-top: 24px;
  }
  footer {
    padding: 24px;
    font-size: 12px;
    color: #6f7066;
    text-align: center;
  }
  a:focus-visible,
  button:focus-visible {
    outline: 2px solid #a3442c;
    outline-offset: 4px;
  }
  @media (max-width: 480px) {
    header {
      padding: 0 20px;
      height: 72px;
    }
    .wordmark {
      font-size: 20px;
    }
    .back {
      font-size: 12px;
    }
    main {
      margin: 40px auto;
    }
  }
</style>
