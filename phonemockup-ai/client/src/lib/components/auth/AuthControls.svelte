<script lang="ts">
  import { page } from "$app/state";
  import { UserRound } from "@lucide/svelte";
  import { auth, getClerk } from "$lib/auth/clerk.svelte";
  import { safeReturnPath } from "$lib/auth/return-path";

  let { compact = false } = $props<{ compact?: boolean }>();
  let userButton = $state<HTMLDivElement>();
  const returnPath = $derived(
    safeReturnPath(`${page.url.pathname}${page.url.search}`),
  );

  $effect(() => {
    const clerk = getClerk();
    if (auth.status !== "ready" || !auth.userId || !clerk || !userButton)
      return;
    const node = userButton;
    clerk.mountUserButton(node);
    return () => clerk.unmountUserButton(node);
  });
</script>

<div class="account-controls" class:compact aria-label="Account">
  {#if auth.userId}
    <div class="user-button" bind:this={userButton}></div>
  {:else}
    <a
      class="sign-in"
      href={`/sign-in?returnTo=${encodeURIComponent(returnPath)}`}
      aria-label="Sign in"
    >
      {#if compact}<UserRound size={17} />{/if}<span>Sign in</span>
    </a>
    {#if !compact}
      <a
        class="sign-up"
        href={`/sign-up?returnTo=${encodeURIComponent(returnPath)}`}>Sign up</a
      >
    {/if}
  {/if}
</div>

<style>
  .account-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    font-family: Archivo, sans-serif;
    font-size: 13px;
  }
  a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 5px;
    text-decoration: none;
    white-space: nowrap;
  }
  .sign-up {
    background: #a3442c;
    color: #fffefa;
  }
  a:focus-visible {
    outline: 2px solid #a3442c;
    outline-offset: 3px;
  }
  .user-button {
    display: grid;
    place-items: center;
    min-width: 44px;
    min-height: 44px;
  }
  .user-button :global(.cl-userButtonTrigger) {
    min-width: 44px;
    min-height: 44px;
    display: grid;
    place-items: center;
  }
  @media (hover: hover) {
    .sign-in:hover {
      background: #88888815;
    }
    .sign-up:hover {
      background: #873823;
    }
  }
  @media (max-width: 760px) {
    .compact .sign-in span {
      display: none;
    }
    .compact a {
      padding-inline: 8px;
    }
  }
</style>
