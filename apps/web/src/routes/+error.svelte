<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>Not found. Checkpost</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <h1>{page.status === 404 ? 'Nothing here.' : 'That went wrong.'}</h1>
  <p>
    {page.error?.message ??
      'Something broke on our side. Try the link again in a moment.'}
  </p>
  <a href="/">Back to Checkpost</a>
</main>

<style>
  main {
    display: grid;
    align-content: center;
    justify-items: start;
    gap: 14px;
    min-height: 100dvh;
    max-width: 30rem;
    margin: 0 auto;
    padding: 40px 20px;
  }

  h1 {
    font-size: clamp(1.9rem, 6vw, 2.5rem);
    font-weight: 700;
  }

  p {
    color: var(--ink-muted);
  }

  a {
    margin-top: 10px;
    font-weight: 600;
    color: var(--primary);
    text-underline-offset: 3px;
  }
</style>
