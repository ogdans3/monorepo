/* Skjemaet, og ikke noe mer.
   Sida fungerer uten dette skriptet også: skjemaet er et vanlig skjema, og
   uten JavaScript får du en side som forteller hva som skjedde. Derfor gjør
   denne fila bare én ting, nemlig å slippe deg for en sidelasting. */

const BESKJEDER = {
  ok: 'Du står på lista. Vi sier fra når det er ute.',
  fantes: 'Du står på lista. Vi sier fra når det er ute.',
  ugyldig_epost: 'Den adressen ser ikke helt riktig ut. Sjekk den en gang til.',
  for_mange: 'Det har kommet nok forsøk fra deg for nå. Prøv igjen om en time.',
  nett: 'Fikk ikke kontakt. Prøv igjen om et øyeblikk.'
};

function settBeskjed(skjema, slag, tekst) {
  const p = skjema.querySelector('[data-beskjed]');
  if (!p) return;
  p.dataset.slag = slag;
  p.textContent = tekst;
}

async function send(skjema, endepunkt) {
  const felt = skjema.querySelector('input[name="epost"]');
  const knapp = skjema.querySelector('button[type="submit"]');
  const gate = skjema.querySelector('input[name="gate"]');
  const epost = felt.value.trim();

  if (epost === '') {
    felt.setAttribute('aria-invalid', 'true');
    settBeskjed(skjema, 'feil', 'Skriv inn en e-postadresse først.');
    felt.focus();
    return;
  }

  const opprinneligTekst = knapp.textContent;
  knapp.disabled = true;
  knapp.textContent = 'Sender…';
  settBeskjed(skjema, 'venter', '');

  let svar;
  try {
    svar = await fetch(endepunkt, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ epost, gate: gate ? gate.value : '', kilde: skjema.dataset.kilde ?? null })
    });
  } catch {
    knapp.disabled = false;
    knapp.textContent = opprinneligTekst;
    settBeskjed(skjema, 'feil', BESKJEDER.nett);
    return;
  }

  const data = await svar.json().catch(() => ({}));

  if (svar.ok) {
    felt.removeAttribute('aria-invalid');
    if (endepunkt.endsWith('/slett')) {
      settBeskjed(skjema, 'ok', 'Adressen er borte fra lista.');
    } else {
      settBeskjed(skjema, 'ok', BESKJEDER.ok);
    }
    // Feltet og knappen blir stående, men tomme. Å fjerne skjemaet ville tatt
    // bort det eneste beviset på hva som nettopp skjedde.
    felt.value = '';
    knapp.disabled = false;
    knapp.textContent = opprinneligTekst;
    return;
  }

  felt.setAttribute('aria-invalid', data.feil === 'ugyldig_epost' ? 'true' : 'false');
  knapp.disabled = false;
  knapp.textContent = opprinneligTekst;
  settBeskjed(skjema, 'feil', BESKJEDER[data.feil] ?? BESKJEDER.nett);
}

for (const skjema of document.querySelectorAll('[data-varsling]')) {
  skjema.addEventListener('submit', (e) => {
    e.preventDefault();
    void send(skjema, '/api/varsling');
  });
}

for (const skjema of document.querySelectorAll('[data-slett]')) {
  skjema.addEventListener('submit', (e) => {
    e.preventDefault();
    void send(skjema, '/api/varsling/slett');
  });
}
