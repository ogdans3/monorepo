<script lang="ts">
  // No links to pages that do not exist. The two things worth saying fit here,
  // and both of them are decisions from `docs/ARCHITECTURE.md` rather than
  // marketing: we are not a party to the trade, and the data stays in the EEA.
  //
  // `postcodes` is for a page that shows a town. A listing's town is usually
  // the one Bring's postcode register gives for its postcode, and the page
  // cannot tell when it is not; the register is licensed under NLOD 2.0, which
  // asks for a credit a person can find. A page with no town would be saying
  // «Inneholder data» about data it does not contain, so the credit is drawn
  // only where a town is. The words are the app's, at the foot of «Juridisk og
  // personvern», and the facts are the ones in the header of
  // `backend/src/lib/postcode-register.ts`: change the three together.
  let { postcodes = false }: { postcodes?: boolean } = $props()
</script>

<footer>
  <div class="inner">
    <p class="mark">swaply</p>
    <p>En byttapp. Vi er ikke part i byttene, og tar verken betaling eller andel.</p>
    <p class="quiet">Driftet i EØS. Vi lagrer aldri fødselsnummer.</p>

    {#if postcodes}
      <!-- A source, not a term: small print under everything else, as in the
           app. `rel="noreferrer"` because the page a town is shown on is
           addressed by the invitation itself, and nobody at the other end of
           these links needs to learn it. -->
      <p class="credit">
        <small>
          <strong>Postnummer</strong>
          Inneholder data under norsk lisens for offentlige data (NLOD) 2.0 tilgjengeliggjort
          av Posten Bring AS. Vi bruker bare postnummeret og stedet, og skriver stedsnavnet med
          vanlig stor forbokstav.
          <span class="sources">
            <span>
              Lisens:
              <a href="https://data.norge.no/nlod/no/2.0" rel="noreferrer">data.norge.no/nlod/no/2.0</a>
            </span>
            <span>
              Kilde:
              <a href="https://www.bring.no/postnummerregister-ansi.txt" rel="noreferrer">
                bring.no/postnummerregister-ansi.txt
              </a>
            </span>
          </span>
        </small>
      </p>
    {/if}
  </div>
</footer>

<style>
  footer {
    border-top: 1px solid var(--line);
    padding: 2.5rem 0 3.5rem;
  }

  .inner {
    width: var(--page);
    margin: 0 auto;
    display: grid;
    gap: 0.4rem;
    max-width: var(--page);
  }

  .mark {
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--green-deep);
    margin-bottom: 0.35rem;
  }

  p {
    color: var(--ink-soft);
    font-size: 0.95rem;
    max-width: 44ch;
  }

  .quiet {
    /* --grey is the app's disabled/decorative tone and does not clear 4.5:1 on
       this background, so the quieter line is smaller rather than lighter. */
    font-size: 0.88rem;
  }

  .credit {
    /* Quieter again than the line above it, and for the same reason by size
       first: --ink-muted is the lightest ink that still clears 4.5:1 here.
       The size is set on the paragraph, not on <small>, or the paragraph's
       own line height spaces the small lines as if they were large. 51ch of
       this size is the 44ch of the lines above, so the column keeps its edge. */
    margin-top: 1.1rem;
    font-size: 0.82rem;
    line-height: 1.5;
    max-width: 51ch;
    color: var(--ink-muted);
  }

  .credit small {
    /* Small print by meaning; its size is the paragraph's. */
    font-size: inherit;
  }

  .credit strong {
    /* The app's label for the same note, in this page's type rather than the
       app's tracked capitals. */
    display: block;
    font-weight: 600;
    color: var(--ink-soft);
  }

  .sources {
    /* Two links stacked in small type: the gap keeps them 24px apart
       centre to centre, so a thumb meant for one does not land on the other. */
    display: grid;
    gap: 0.3rem;
    margin-top: 0.35rem;
  }

  .sources > span {
    /* The addresses are long unbroken words, and a 320-wide phone would
       otherwise push them past the edge of the page. */
    overflow-wrap: anywhere;
  }

  .credit a {
    text-underline-offset: 0.15em;
  }

  .credit a:hover {
    color: var(--ink);
  }
</style>
