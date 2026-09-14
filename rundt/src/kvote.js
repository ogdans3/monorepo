/**
 * Enkel kvote per avsender, med en tellebøtte som tømmes over tid.
 *
 * Dette er ikke et forsvar mot noen som virkelig vil fylle lista — de bytter
 * bare IP. Det er et forsvar mot et skript som står og trykker, og mot at et
 * skjema med autofyll sender det samme fem ganger.
 */
export class Kvote {
  #boetter = new Map(); // nøkkel -> { antall, nullstillesVed }
  #maks;
  #vindu;

  constructor({ maks = 5, vinduMs = 60 * 60 * 1000 } = {}) {
    this.#maks = maks;
    this.#vindu = vinduMs;
  }

  /** true om forespørselen får gå gjennom. */
  slippGjennom(nokkel, na = Date.now()) {
    this.#ryddOpp(na);
    const boette = this.#boetter.get(nokkel);
    if (!boette || boette.nullstillesVed <= na) {
      this.#boetter.set(nokkel, { antall: 1, nullstillesVed: na + this.#vindu });
      return true;
    }
    if (boette.antall >= this.#maks) return false;
    boette.antall += 1;
    return true;
  }

  // Uten dette vokser kartet for hver IP som noensinne har vært innom.
  #ryddOpp(na) {
    if (this.#boetter.size < 1000) return;
    for (const [k, v] of this.#boetter) {
      if (v.nullstillesVed <= na) this.#boetter.delete(k);
    }
  }
}
