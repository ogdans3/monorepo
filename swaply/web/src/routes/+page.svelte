<script lang="ts">
  import { goto } from '$app/navigation'
  import Loop from '$lib/components/Loop.svelte'
  import Footer from '$lib/components/Footer.svelte'

  // The landing page of an invite-only app is not a sign-up funnel: there is
  // nothing to sign up for. What it can do is take the link somebody was sent
  // and open it, which is why the one field here is a paste box.
  //
  // The form posts to /apne, which does exactly the same thing on the server.
  // This handler only saves the round trip; with JavaScript off the box still
  // works.
  let pasted = $state('')
  let error = $state<string | null>(null)

  const TOKEN = /^[A-Za-z0-9_-]{16,64}$/

  function open(event: SubmitEvent) {
    event.preventDefault()
    const trimmed = pasted.trim()
    // A whole URL, or the token on its own if someone read it off a screen.
    const token = trimmed.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? ''

    if (!TOKEN.test(token)) {
      error = 'Det ser ikke ut som en Swaply-lenke. Lim inn hele lenken du fikk.'
      return
    }
    error = null
    goto(`/i/${token}`)
  }
</script>

<svelte:head>
  <title>Swaply — si hva du vil ha, så bytter dere</title>
  <meta
    name="description"
    content="Swaply er en byttapp. Du sier hva du vil ha, og når ønskene lukker en sirkel — direkte eller gjennom en kjede på tre — bytter dere. Ingen frakt, ingen betaling, ingen andel til oss."
  />
  <meta property="og:title" content="Swaply — si hva du vil ha, så bytter dere" />
  <meta
    property="og:description"
    content="En byttapp. Når ønskene lukker en sirkel, bytter dere."
  />
  <meta property="og:type" content="website" />
  <meta name="theme-color" content="#064e3b" />
</svelte:head>

<header class="hero">
  <div class="hero-inner">
    <p class="wordmark">swaply</p>

    <div class="hero-grid">
      <div class="hero-copy">
        <p class="badge">Invitasjonsbasert</p>
        <h1>Si hva du vil ha.</h1>
        <p class="lead">
          Når ønskene lukker en sirkel, bytter dere. Direkte med én annen, eller gjennom
          en kjede på tre.
        </p>
        <a class="button-light" href="#invitasjon">Jeg har fått en lenke</a>
      </div>

      <figure class="hero-figure">
        <Loop />
        <figcaption>Pilene er ønsker. Tingene går motsatt vei.</figcaption>
      </figure>
    </div>
  </div>
</header>

<main>
  <section class="steps" aria-labelledby="slik">
    <h2 id="slik">Slik skjer et bytte</h2>
    <ol>
      <li>
        <span class="step-no" aria-hidden="true">1</span>
        <h3>Du trykker på hjertet</h3>
        <p>
          Hjertet sier «jeg vil ha denne», og er den eneste streken vi tegner mellom to
          mennesker. Ingenting annet i appen betyr noe før den finnes.
        </p>
      </li>
      <li>
        <span class="step-no" aria-hidden="true">2</span>
        <h3>Sirkelen lukker seg</h3>
        <p>
          To som vil ha hverandres ting er det enkle tilfellet. Tre som peker rundt er det
          morsomme: ingen av dem vil ha det den forrige har.
        </p>
      </li>
      <li>
        <span class="step-no" aria-hidden="true">3</span>
        <h3>Dere avtaler resten</h3>
        <p>
          Dere blir enige i chatten og møtes. Er tingene ulikt verdt, noterer vi
          mellomlegget dere selv ble enige om.
        </p>
      </li>
    </ol>
  </section>

  <section class="statement" aria-labelledby="ikke-part">
    <div class="statement-inner">
      <h2 id="ikke-part">Vi er ikke part i byttet.</h2>
      <div>
        <p>
          Vi frakter ingenting, tar imot ingen betaling, og tar ingen andel. Avtalen er
          mellom deg og den du bytter med. Et mellomlegg er et tall dere er enige om og
          som vi skriver ned — aldri en overføring vi utfører.
        </p>
        <ul class="facts">
          <li>Ingen frakt</li>
          <li>Ingen betaling</li>
          <li>Ingen andel</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="trust" aria-labelledby="tillit">
    <h2 id="tillit">Tillit uten fødselsnummer</h2>
    <div class="trust-grid">
      <p>
        <strong>BankID er et merke, ikke en innlogging.</strong> Den bekrefter at du er en
        ekte person, og gir oss en pseudonym referanse og et tidspunkt. Fødselsnummeret
        ditt ser vi aldri, og vi vil ikke ha det.
      </p>
      <p>
        <strong>Invitasjon, ikke torg.</strong> Man kommer inn via en lenke fra noen som
        allerede er her. Et lite nabolag er tryggere enn en stor markedsplass, og det er
        hele grunnen til at døra er lukket.
      </p>
      <p>
        <strong>Sletting er sletting.</strong> Ber du om det, tømmes profilen med en gang.
        En minimal identitetspost ligger adskilt i tre år etter siste gjennomførte bytte,
        i tilfelle noen må fremme eller forsvare et krav.
      </p>
    </div>
  </section>

  <section class="invite" id="invitasjon" aria-labelledby="lenke">
    <div class="invite-inner">
      <h2 id="lenke">Har du fått en lenke?</h2>
      <p>Lim den inn her, så åpner vi den.</p>

      <form method="GET" action="/apne" onsubmit={open} novalidate>
        <label class="sr-only" for="lenke-felt">Invitasjonslenke</label>
        <input
          id="lenke-felt"
          name="lenke"
          type="text"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          placeholder="Lim inn lenken du fikk"
          bind:value={pasted}
          aria-describedby={error ? 'lenke-feil' : undefined}
          aria-invalid={error ? 'true' : undefined}
        />
        <button type="submit">Åpne</button>
      </form>

      {#if error}
        <p class="error" id="lenke-feil" role="alert">{error}</p>
      {/if}

      <p class="fine">
        Har du ingen lenke, må du kjenne noen som er her. Sånn er det med invitasjoner.
      </p>
    </div>
  </section>
</main>

<Footer />

<style>
  .hero {
    background: var(--green-deep);
    color: var(--on-green);
    padding: clamp(1.5rem, 4vw, 2.5rem) 0 clamp(3.5rem, 8vw, 6rem);
  }

  .hero-inner {
    width: var(--page);
    margin: 0 auto;
  }

  .wordmark {
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: -0.045em;
    margin-bottom: clamp(3rem, 9vw, 6rem);
  }

  .hero-grid {
    display: grid;
    gap: clamp(2.5rem, 6vw, 4rem);
    align-items: center;
  }

  @media (min-width: 56rem) {
    .hero-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .badge {
    display: inline-block;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--on-green);
    border: 1px solid rgba(242, 247, 244, 0.32);
    border-radius: var(--radius-pill);
    padding: 0.3rem 0.85rem;
    margin-bottom: 1.5rem;
  }

  h1 {
    font-size: clamp(2.9rem, 8.5vw, 4.75rem);
    font-weight: 700;
  }

  .lead {
    margin-top: 1.25rem;
    max-width: 26rem;
    font-size: clamp(1.1rem, 2.4vw, 1.3rem);
    color: var(--on-green-soft);
  }

  .button-light {
    display: inline-block;
    margin-top: 2rem;
    padding: 0.95rem 1.7rem;
    border-radius: var(--radius-pill);
    background: var(--on-green);
    color: var(--green-deep);
    font-weight: 700;
    text-decoration: none;
    transition: transform 220ms var(--ease-out), background-color 220ms var(--ease-out);
  }

  .button-light:hover {
    background: #fff;
    transform: translateY(-1px);
  }

  .hero-figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
  }

  figcaption {
    color: var(--on-green-soft);
    font-size: 0.95rem;
    text-align: center;
  }

  main {
    width: var(--page);
    margin: 0 auto;
  }

  section {
    padding: clamp(3.5rem, 9vw, 6.5rem) 0;
  }

  h2 {
    font-size: clamp(1.9rem, 4.5vw, 2.9rem);
    font-weight: 700;
    max-width: 18ch;
  }

  .steps ol {
    list-style: none;
    margin: clamp(2rem, 5vw, 3rem) 0 0;
    padding: 0;
    display: grid;
    gap: clamp(2rem, 4vw, 2.75rem);
  }

  @media (min-width: 48rem) {
    .steps ol {
      grid-template-columns: repeat(3, 1fr);
      gap: 2.5rem;
    }
  }

  .steps li {
    /* A real sequence, so the number carries information. The rule underneath
       ties the three together without turning them into cards. */
    border-top: 1px solid var(--line);
    padding-top: 1.25rem;
  }

  .step-no {
    display: block;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--green-pressed);
    margin-bottom: 0.6rem;
  }

  .steps h3 {
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .steps p {
    margin-top: 0.6rem;
    color: var(--ink-soft);
    max-width: 34ch;
  }

  .statement {
    background: var(--green-soft);
    border-radius: var(--radius-lg);
    padding: clamp(2.5rem, 6vw, 4.5rem);
  }

  .statement-inner {
    display: grid;
    gap: clamp(1.5rem, 3vw, 2.5rem);
    align-items: start;
  }

  @media (min-width: 56rem) {
    .statement-inner {
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
    }

    .statement h2 {
      /* The claim is the loudest thing in the section; the argument sits
         beside it rather than under it. */
      font-size: clamp(2.2rem, 4vw, 3.2rem);
    }
  }

  .statement p {
    font-size: clamp(1.05rem, 2vw, 1.2rem);
    max-width: var(--measure);
    color: #1c2b23;
  }

  .facts {
    list-style: none;
    margin: 1.75rem 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 2rem;
    font-weight: 600;
    color: var(--green-deep);
  }

  .facts li::before {
    content: '—';
    margin-right: 0.55rem;
    color: var(--green);
  }

  .trust-grid {
    margin-top: clamp(2rem, 5vw, 3rem);
    display: grid;
    gap: 2rem;
  }

  @media (min-width: 48rem) {
    .trust-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .trust-grid p {
    color: var(--ink-soft);
    max-width: 36ch;
  }

  .trust-grid strong {
    display: block;
    color: var(--ink);
    font-weight: 700;
  }

  .invite {
    background: var(--green-deep);
    color: var(--on-green);
    border-radius: var(--radius-lg);
    padding: clamp(2.5rem, 6vw, 4.5rem);
    margin-bottom: clamp(3rem, 7vw, 5rem);
  }

  .invite-inner {
    max-width: 40rem;
  }

  .invite p {
    margin-top: 1rem;
    color: var(--on-green-soft);
  }

  form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.75rem;
  }

  input {
    flex: 1 1 18rem;
    min-width: 0;
    font: inherit;
    color: var(--ink);
    background: var(--on-green);
    border: 1.5px solid transparent;
    border-radius: var(--radius-pill);
    padding: 0.9rem 1.35rem;
  }

  input::placeholder {
    /* Placeholders carry the same contrast rule as body text. */
    color: #5d6a63;
  }

  input[aria-invalid='true'] {
    border-color: var(--coral);
  }

  button {
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    border: 0;
    border-radius: var(--radius-pill);
    padding: 0.9rem 2rem;
    background: var(--green);
    color: #05291e;
    transition: transform 220ms var(--ease-out), background-color 220ms var(--ease-out);
  }

  button:hover {
    background: #16cd78;
    transform: translateY(-1px);
  }

  .error {
    margin-top: 0.9rem;
    color: #ffd7d2;
    font-size: 0.95rem;
  }

  .fine {
    margin-top: 1.75rem;
    font-size: 0.95rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
