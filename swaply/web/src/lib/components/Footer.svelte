<script lang="ts">
  // No links to pages that do not exist. The two things worth saying fit here,
  // and both of them are decisions from `docs/ARCHITECTURE.md` rather than
  // marketing: we are not a party to the trade, and the data stays in the EEA.
</script>

<footer>
  <div class="inner">
    <p class="mark">swaply</p>
    <p>En byttapp. Vi er ikke part i byttene, og tar verken betaling eller andel.</p>
    <p class="quiet">Driftet i EØS. Vi lagrer aldri fødselsnummer.</p>
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
</style>
