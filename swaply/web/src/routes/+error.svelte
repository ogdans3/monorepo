<script lang="ts">
  import { page } from '$app/state'
  import Footer from '$lib/components/Footer.svelte'

  // A person who lands here has almost always followed a link somebody sent
  // them, so the page says what to do about it rather than printing a number.
  const heading = $derived(
    page.status === 404 ? 'Denne lenken fører ingen steder' : 'Noe gikk galt hos oss',
  )
</script>

<svelte:head>
  <title>{heading} — Swaply</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header>
  <div class="bar"><a class="wordmark" href="/">swaply</a></div>
</header>

<main>
  <h1>{heading}</h1>
  <p>{page.error?.message ?? 'Prøv igjen om litt.'}</p>
  <p class="fine">
    Invitasjoner kan brukes én gang, og en lenke som er skrevet av litt feil finner vi
    ikke igjen. Be den som sendte den om en ny.
  </p>
  <a class="button" href="/">Til forsiden</a>
</main>

<Footer />

<style>
  header {
    background: var(--green-deep);
    color: var(--on-green);
  }

  .bar {
    width: var(--page);
    margin: 0 auto;
    padding: 1.1rem 0;
  }

  .wordmark {
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.045em;
    text-decoration: none;
  }

  main {
    width: var(--page);
    margin: 0 auto;
    padding: clamp(3rem, 8vw, 5.5rem) 0 clamp(3rem, 7vw, 5rem);
    max-width: 44rem;
  }

  h1 {
    font-size: clamp(2.1rem, 5.5vw, 3rem);
    font-weight: 700;
  }

  p {
    margin-top: 1.1rem;
    color: var(--ink-soft);
    max-width: var(--measure);
  }

  .fine {
    font-size: 0.95rem;
  }

  .button {
    display: inline-block;
    margin-top: 2rem;
    padding: 0.95rem 1.9rem;
    border-radius: var(--radius-pill);
    background: var(--green-pressed);
    color: #fff;
    font-weight: 700;
    text-decoration: none;
  }
</style>
