# Working in hva-koster-norge

Les `README.md` for arkitektur, `PRODUCT.md` og `DESIGN.md` for
designbeslutninger. Denne fila er kortversjonen av det som betyr noe når du
endrer noe.

## Regler

- **Selvstendig.** Denne mappa må bygge, teste og deploye alene
  (monorepo-regelen). Aldri referer til noe utenfor `hva-koster-norge/`.
- **Et tall uten kilde vises ikke.** `Kilde` er påkrevd i typene i
  `src/lib/data.ts`, og det er ikke en formalitet: siden handler om
  politikk, og "hvor har du det fra" er det første en leser har krav på å
  spørre om. Ikke gjør feltet valgfritt for å slippe å fylle det ut.
- **`foreløpig`-flagget skal stå til tallene er ekte.** Så lenge det er
  `true` viser forsiden en advarsel. Ikke fjern advarselen for at siden
  skal se penere ut på et skjermbilde. Budsjettallene er plassholdere til
  noen har lest dem ut av de faktiske dokumentene.
- **Én felles målestokk per side.** `Merkefelt` tar `skala` som påkrevd
  prop, og den regnes ut én gang av sida ut fra det største feltet. Å la
  hvert felt velge sin egen var den første versjonen, og den fikk 350
  milliarder og 45 milliarder til å se like store ut. Det er den ene feilen
  som gjør hele bildet verdiløst.
- **Kvadrater, ikke sirkler.** Kvadrater flislegger uten hull, så feltets
  areal er proporsjonalt med beløpet. Sirkler ville latt 21% av plassen stå
  tom og dermed løyet om proporsjonen bildet påstår.
- **Partier får aldri sin egen merkevarefarge i stor flate.** Følger av
  anti-referansen i PRODUCT.md. Form og posisjon skiller dem, farge sist,
  og alt som formidles med farge finnes også som tekst. Testen er at siden
  skal fungere i gråtoner.
- **NBSP skrives som ` `, aldri som et litteralt tegn.** Norsk
  tusenskille er hardt mellomrom, og som litteral er det umulig å skille
  fra et vanlig mellomrom i enhver editor og enhver diff. Det ble stille
  gjort om til et vanlig mellomrom første gang `format.ts` ble skrevet, og
  testene fanget det.
- **Minus fra `toLocaleString('nb-NO')` er U+2212, ikke bindestrek.** Det
  er riktig: tegnet er like bredt som et siffer, så det står i kolonne med
  tabulære tall. Ikke "fiks" det til ASCII.
- **Kontrast regnes ut, ikke anslås.** Aksenten sto først på L 0.62 og ga
  3,8:1 med hvit tekst, altså under AA. Både den og primæren ligger nå tett
  på gulvet, så flytter du én må du regne om den andre samtidig.
- **Mobil er flaten.** 360px først. Alt som krever bred skjerm for å gi
  mening er feil løsning, ikke et responsivt problem å fikse etterpå.
- **Ingen kort, ingen rutenett av like kort, ingen liten sperret versal
  over hver seksjon.** Alle tre er utpekt som mettet AI-grammatikk i
  impeccable-ferdigheten, og seksjonene skilles med luft og hierarki.

## Verify

```sh
pnpm test && pnpm check && pnpm build
```

Skjermbilde på ekte mobilbredde er en del av verifiseringen, ikke en ekstra
runde: feilen med at alle feltene ble like store var usynlig i koden og
åpenbar i et bilde på 390px.
