import { appendFileSync, mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { nokkel } from './epost.js';

/**
 * Lista over folk som vil ha beskjed, lagret som JSON-linjer på disk.
 *
 * Én linje per hendelse, aldri redigert på plass — bortsett fra en sletting,
 * som skriver hele fila om. Det er den eneste operasjonen som må fjerne noe,
 * og en person som ber om å bli slettet skal faktisk bli borte fra fila, ikke
 * bare markert. GDPR artikkel 17 er ikke en tombstone.
 *
 * Formatet er med vilje kjedelig: `cat data/liste.jsonl` er hele
 * eksportfunksjonen, og det er den mest sannsynlige måten denne lista
 * noensinne blir lest på.
 */
export class Lager {
  #fil;
  #adresser = new Map(); // nøkkel -> { epost, tidspunkt }

  constructor(katalog) {
    mkdirSync(katalog, { recursive: true });
    this.#fil = join(katalog, 'liste.jsonl');
    this.#lesInn();
  }

  #lesInn() {
    if (!existsSync(this.#fil)) return;
    for (const linje of readFileSync(this.#fil, 'utf8').split('\n')) {
      if (linje.trim() === '') continue;
      let rad;
      try {
        rad = JSON.parse(linje);
      } catch {
        // En halvskrevet siste linje etter en hard omstart skal ikke hindre
        // resten av lista i å bli lest.
        continue;
      }
      if (typeof rad?.epost === 'string') {
        this.#adresser.set(nokkel(rad.epost), { epost: rad.epost, tidspunkt: rad.tidspunkt ?? null });
      }
    }
  }

  get antall() {
    return this.#adresser.size;
  }

  har(adresse) {
    return this.#adresser.has(nokkel(adresse));
  }

  /**
   * Legg til en adresse. Returnerer 'ny' eller 'fantes'.
   *
   * At den allerede fantes er ikke en feil for den som sender inn: svaret ut
   * er det samme uansett, ellers blir skjemaet et oppslagsverk over hvem som
   * står på lista.
   */
  leggTil(adresse, kilde = null) {
    if (this.har(adresse)) return 'fantes';
    const rad = { epost: adresse, tidspunkt: new Date().toISOString(), kilde };
    appendFileSync(this.#fil, JSON.stringify(rad) + '\n');
    this.#adresser.set(nokkel(adresse), { epost: adresse, tidspunkt: rad.tidspunkt });
    return 'ny';
  }

  /** Fjern en adresse helt. Returnerer true om den sto der. */
  slett(adresse) {
    if (!this.har(adresse)) return false;
    this.#adresser.delete(nokkel(adresse));
    const innhold = [...this.#adresser.values()]
      .map((r) => JSON.stringify({ epost: r.epost, tidspunkt: r.tidspunkt }) + '\n')
      .join('');
    // Skriv ny fil og bytt den inn, så en strømstans midt i en sletting ikke
    // etterlater en halv liste.
    const midlertidig = this.#fil + '.ny';
    writeFileSync(midlertidig, innhold);
    renameSync(midlertidig, this.#fil);
    return true;
  }
}
