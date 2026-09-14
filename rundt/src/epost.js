// Adressevalidering. Bevisst romslig: en landingsside skal ikke avvise en
// gyldig adresse fordi den har et uvanlig toppdomene eller et plusstegn. Den
// eneste jobben her er å fange skrivefeil og å nekte noe som ikke kan lagres.

export const MAKS_LENGDE = 254; // RFC 5321 sin grense for en hel adresse

// Ett @, noe på hver side, minst ett punktum i domenet, ingen mellomrom.
const FORM = /^[^\s@,;:<>"'\\]+@[^\s@,;:<>"'\\]+\.[^\s@,;:<>"'\\]{2,}$/;

/**
 * Normaliser en innsendt adresse, eller null om den ikke kan brukes.
 * Normalisering er nødvendig for at duplikatsjekken skal bety noe:
 * "Ola@Eksempel.NO " og "ola@eksempel.no" er samme innboks.
 *
 * Bare domenet settes til små bokstaver. Lokaldelen er i prinsippet
 * versalfølsom, og å slå den sammen kunne slått to ulike adresser i hop.
 */
export function normaliser(verdi) {
  if (typeof verdi !== 'string') return null;
  const trimmet = verdi.trim();
  if (trimmet.length === 0 || trimmet.length > MAKS_LENGDE) return null;
  if (!FORM.test(trimmet)) return null;
  const skille = trimmet.lastIndexOf('@');
  const lokal = trimmet.slice(0, skille);
  const domene = trimmet.slice(skille + 1).toLowerCase();
  if (domene.startsWith('.') || domene.endsWith('.') || domene.includes('..')) return null;
  return `${lokal}@${domene}`;
}

/** Nøkkelen duplikater sjekkes mot. Hele adressen i små bokstaver. */
export function nokkel(adresse) {
  return adresse.toLowerCase();
}
