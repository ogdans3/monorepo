<script lang="ts">
  import Footer from '$lib/components/Footer.svelte'
  import Loop from '$lib/components/Loop.svelte'
  import { categoryLine, conditionLabels, kr } from '$lib/labels'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  const invite = $derived(data.invite)
  const item = $derived(invite.item)
  const inviterName = $derived(invite.inviter?.displayName ?? null)
  const openInApp = $derived(`${data.appOrigin}/?invitasjon=${invite.token}`)

  const facts = $derived(
    item
      ? [
          categoryLine(item.category, item.subcategory),
          item.condition ? `Tilstand: ${conditionLabels[item.condition]}` : null,
          item.town,
          item.kind === 'service' ? 'Tjeneste' : null,
        ].filter((f): f is string => Boolean(f))
      : [],
  )
</script>

<svelte:head>
  <title>{item ? `${item.title} — Swaply` : 'Du er invitert til Swaply'}</title>
  <meta name="description" content={invite.shareText} />
  <!-- A shared listing is for whoever was handed the link, not for a search
       index. The landing page is the page we want found. -->
  <meta name="robots" content="noindex, nofollow" />
  <meta property="og:site_name" content="Swaply" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={invite.url} />
  <meta
    property="og:title"
    content={item ? `${item.title}${kr(item.estimatedValueNok) ? ` — verdi ${kr(item.estimatedValueNok)}` : ''}` : 'Du er invitert til Swaply'}
  />
  <meta property="og:description" content={invite.shareText} />
  {#if item?.media[0]}
    <meta property="og:image" content={item.media[0]} />
    <meta name="twitter:card" content="summary_large_image" />
  {:else}
    <meta name="twitter:card" content="summary" />
  {/if}
  <meta name="theme-color" content="#064e3b" />
</svelte:head>

<header>
  <div class="bar">
    <a class="wordmark" href="/">swaply</a>
    {#if item && inviterName}
      <!-- On a plain invitation the headline already says this, and saying it
           twice on one screen is worse than not saying it at all. -->
      <p class="from">{inviterName} inviterer deg</p>
    {/if}
  </div>
</header>

<main>
  {#if item}
    <article class="listing">
      <div class="gallery">
        {#if item.media.length > 0}
          <figure class="cover">
            <img src={item.media[0]} alt={item.title} width="1200" height="900" />
          </figure>
          {#if item.media.length > 1}
            <div class="more">
              {#each item.media.slice(1) as photo, i (photo)}
                <figure>
                  <img src={photo} alt={`${item.title}, bilde ${i + 2}`} loading="lazy" />
                </figure>
              {/each}
            </div>
          {/if}
        {:else}
          <!-- A listing may have no photo and a service usually has none, so
               this is a real state rather than a placeholder: a caption panel
               that says what the thing is and admits what is missing. -->
          <figure class="cover empty">
            <p class="empty-what">{categoryLine(item.category, item.subcategory)}</p>
            <p class="empty-note">Uten bilde</p>
          </figure>
        {/if}
      </div>

      <div class="details">
        <h1>{item.title}</h1>
        {#if kr(item.estimatedValueNok)}
          <p class="value">Verdi {kr(item.estimatedValueNok)}</p>
        {/if}

        <ul class="facts">
          {#each facts as fact (fact)}
            <li>{fact}</li>
          {/each}
        </ul>

        {#if item.description}
          <p class="description">{item.description}</p>
        {/if}

        {#if item.ownerName}
          <p class="owner">
            <span class="avatar" aria-hidden="true">{item.ownerName.slice(0, 1)}</span>
            <span>{item.ownerName} har lagt den ut</span>
          </p>
        {/if}

        <div class="cta">
          {#if invite.used}
            <p class="notice" role="status">
              Denne invitasjonen er allerede brukt.
              {#if inviterName}Be {inviterName} om en ny lenke.{:else}Be om en ny lenke.{/if}
            </p>
          {/if}
          <a class="button" href={openInApp}>Åpne i Swaply</a>
          <p class="fine">
            Swaply er invitasjonsbasert, og lenken du fikk er nøkkelen. Appen til iOS og
            Android kommer; foreløpig åpner den i nettleseren.
          </p>
        </div>
      </div>
    </article>
  {:else}
    <section class="plain">
      <div class="plain-copy">
        <h1>
          {#if inviterName}{inviterName} inviterer deg til Swaply.{:else}Du er invitert til
            Swaply.{/if}
        </h1>
        <p class="lead">
          Si hva du vil ha. Når ønskene lukker en sirkel — direkte, eller gjennom en kjede
          på tre — bytter dere.
        </p>

        {#if invite.used}
          <p class="notice" role="status">
            Denne invitasjonen er allerede brukt.
            {#if inviterName}Be {inviterName} om en ny lenke.{:else}Be om en ny lenke.{/if}
          </p>
        {/if}

        <a class="button" href={openInApp}>Åpne i Swaply</a>
        <p class="fine">
          Vi frakter ingenting, tar ingen betaling og tar ingen andel. Avtalen er mellom
          deg og den du bytter med.
        </p>
      </div>

      <figure class="plain-figure">
        <Loop compact />
        <figcaption>Pilene er ønsker. Tingene går motsatt vei.</figcaption>
      </figure>
    </section>
  {/if}
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
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .wordmark {
    /* The padding is the tap target, not the type: a thumb needs 44px and the
       word is 26 tall. The negative margin keeps the bar the height it draws. */
    display: inline-block;
    padding: 9px 4px;
    margin: -9px -4px;
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.045em;
    text-decoration: none;
  }

  .from {
    color: var(--on-green-soft);
    font-size: 0.95rem;
  }

  main {
    width: var(--page);
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 3.5rem) 0 clamp(3rem, 7vw, 5rem);
  }

  .listing {
    display: grid;
    gap: clamp(1.75rem, 4vw, 3.5rem);
    align-items: start;
  }

  @media (min-width: 52rem) {
    .listing {
      grid-template-columns: 1.05fr 1fr;
    }
  }

  .cover {
    margin: 0;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--green-soft);
    aspect-ratio: 4 / 3;
  }

  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover.empty {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: clamp(1.25rem, 3vw, 2rem);
    /* Shorter than a photo would be: an empty panel does not earn the height a
       picture does. */
    aspect-ratio: 3 / 2;
  }

  .empty-what {
    font-size: clamp(1.4rem, 3.5vw, 2rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--green-deep);
  }

  .empty-note {
    margin-top: 0.35rem;
    color: var(--green-pressed);
    font-size: 0.95rem;
  }

  .more {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .more figure {
    margin: 0;
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--green-soft);
    aspect-ratio: 1;
  }

  .more img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  h1 {
    font-size: clamp(2.1rem, 5.5vw, 3.1rem);
    font-weight: 700;
  }

  .value {
    margin-top: 0.6rem;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--green-pressed);
  }

  .facts {
    list-style: none;
    margin: 1.5rem 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .facts li {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    padding: 0.35rem 0.85rem;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .description {
    margin-top: 1.5rem;
    color: var(--ink-soft);
    max-width: var(--measure);
  }

  .owner {
    margin-top: 1.75rem;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    font-weight: 600;
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    background: var(--green-deep);
    color: var(--on-green);
    font-weight: 700;
    text-transform: uppercase;
  }

  .cta {
    margin-top: clamp(2rem, 4vw, 2.75rem);
    padding-top: clamp(1.5rem, 3vw, 2rem);
    border-top: 1px solid var(--line);
  }

  .button {
    display: inline-block;
    padding: 1rem 2rem;
    border-radius: var(--radius-pill);
    background: var(--green-pressed);
    color: #fff;
    font-weight: 700;
    text-decoration: none;
    transition: transform 220ms var(--ease-out), background-color 220ms var(--ease-out);
  }

  .button:hover {
    background: var(--green-deep);
    transform: translateY(-1px);
  }

  .notice {
    margin-bottom: 1.25rem;
    padding: 0.9rem 1.1rem;
    border-radius: var(--radius);
    background: #fff3f1;
    color: #6b2a24;
    font-size: 0.95rem;
    max-width: var(--measure);
  }

  .fine {
    margin-top: 1.1rem;
    color: var(--ink-soft);
    font-size: 0.92rem;
    max-width: 42ch;
  }

  .plain {
    display: grid;
    gap: clamp(2.5rem, 6vw, 4rem);
    align-items: center;
    background: var(--green-deep);
    color: var(--on-green);
    border-radius: var(--radius-lg);
    padding: clamp(2rem, 6vw, 4rem);
  }

  @media (min-width: 52rem) {
    .plain {
      grid-template-columns: 1fr 1fr;
    }
  }

  .plain h1 {
    font-size: clamp(2rem, 5vw, 3rem);
  }

  .lead {
    margin-top: 1.25rem;
    color: var(--on-green-soft);
    max-width: 28rem;
  }

  .plain .button {
    margin-top: 2rem;
    background: var(--on-green);
    color: var(--green-deep);
  }

  .plain .button:hover {
    background: #fff;
  }

  .plain .fine {
    color: var(--on-green-soft);
  }

  .plain .notice {
    margin-top: 1.75rem;
    margin-bottom: 0;
    background: rgba(255, 107, 94, 0.16);
    color: #ffd7d2;
  }

  .plain-figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .plain-figure figcaption {
    color: var(--on-green-soft);
    font-size: 0.92rem;
    text-align: center;
  }
</style>
