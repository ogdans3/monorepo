# Design

Hvordan siden ser ut. `PRODUCT.md` er hvorfor. Der de er uenige, vinner
PRODUCT.md.

## Theme

Lys. Ren hvit flate, mineralsk grønn som primær, nesten-svart tekst.

Valget er ikke standardvalget, det er begrunnet. Scenen er noen som står på
en buss med telefonen i hånda, ofte utendørs, ofte i dårlig lys eller sterkt
dagslys. Hvit flate med svart tekst er det som faktisk lar seg lese der. Den
andre grunnen er politisk: en mørk, farget flate ville latt én farge
dominere hele siden, og fargen vi fikk tildelt eies av tre norske partier.

Tilbakeholdenhet er en risiko i dette registeret. Motgiften er ikke å skru
opp fargen, men å la **merkefeltet** bære all visuell vekt. Flaten er stille
nettopp for at feltet skal kunne rope.

## Color

OKLCH gjennomgående. Ingen hex.

```css
--bg:       oklch(1.000 0.000 0);      /* ren hvit, ikke 0.99, ingen skjult varme */
--surface:  oklch(0.968 0.006 160);    /* bg trukket mot blekk, samme hue-familie */
--ink:      oklch(0.185 0.018 160);    /* brødtekst, 18,6:1 mot bg */
--muted:    oklch(0.520 0.020 160);    /* sekundærtekst, 5.4:1 mot bg */
--line:     oklch(0.900 0.008 160);    /* hårstreker og tabellinjer */

--primary:  oklch(0.430 0.098 160);    /* mosegrønn, 7,7:1 mot bg */
--accent:   oklch(0.580 0.150 52);     /* brent oker, 4,5:1 med hvit tekst */
```

**Fargestrategi: forpliktet, men i merkene.** Primær og aksent dekker langt
under 10% av flaten, som ellers ville vært Restrained. Det som gjør den
forpliktet er at merkefeltet kan fylle en hel skjerm med primær når det
skal, og at ingenting annet på siden konkurrerer om oppmerksomheten.

**Primæren er dyttet mørkere enn fargefrøet** (L 0.43 mot frøets 0.55). To
grunner: den må bære hvit tekst i en fylt flate, og den må lese som våt
stein framfor partilogo. Partigrønt ligger lyst og mettet. Denne gjør ikke.

Alle verdiene over er regnet ut, ikke anslått. Aksenten sto først på L 0.62
og ga bare 3,8:1 med hvit tekst, altså under AA. Den er dyttet til 0.58, som
gir 4,52:1 med hvit og 1,70:1 mot primær. Begge ligger tett på gulvet, så
hvis en av dem må flyttes senere må den andre regnes om samtidig.

**Aksenten er brent oker, ikke komplementær-etter-oppskrift.** Den er der
for én ting: avvik fra vedtatt budsjett. Et parti som vil bruke mer får
oker, et som vil bruke mindre får primær. Aldri rødt og grønt, som er den
vanligste fargeblindhetsfellen og dessuten leser som moralsk dom.

### Partikoding

Partier får **aldri** sine egne merkevarefarger i stor flate. Det er en
regel, ikke en preferanse, og den følger av anti-referansen.

Der partier må skilles fra hverandre bruker vi form og posisjon først,
farge sist: ulik skravur i merkefeltet, navnet skrevet ut, og tallet ved
siden av. Alt som formidles med farge finnes også som tekst eller tall.
Testen er at siden skal fungere i gråtoner.

## Typography

**Én familie: Schibsted Grotesk.** Selvhostet som woff2, ikke hentet fra
Google, siden dette er en norsk side rettet mot allmennheten og en
tredjepartsforespørsel per besøk er en unødvendig personopplysning.

Én familie framfor et par, fordi et forsiktig display-og-brødtekst-par leser
som ubesluttsomhet. Kontrasten kommer fra vekt og skala, ikke fra en ekstra
skrift.

Schibsted Grotesk er norsk, tegnet for tett tallsats, og har ekte tabulære
sifre. Den er ikke på impeccables avvisningsliste, og den bærer en nøktern,
litt teknisk stemme uten å bli kontorprogramvare.

```css
--font: 'Schibsted Grotesk', system-ui, sans-serif;
```

- Display: 800, `clamp(2.4rem, 9vw, 5.2rem)`, `letter-spacing: -0.035em`,
  `text-wrap: balance`. Taket er godt under 6rem.
- Brødtekst: 400, `1.0625rem`/`1.6`, maks 68ch, `text-wrap: pretty`.
- Tall: `font-variant-numeric: tabular-nums` overalt hvor tall står i
  kolonne eller endrer seg. Uten dette hopper sifrene når en teller går.
- Skala: 1.28 mellom trinn. Flate skalaer leser som uforpliktende.

Ingen små versaler med sperret tegnavstand som overskrift over hver seksjon.
Den er utpekt som mettet AI-grammatikk, og den ville dessuten trekke siden
mot den redaksjonelt-typografiske lanen vi har valgt bort.

## The mark field

Sidens ene visuelle idé, og det som gjør oversettelsen konkret.

Hvert merke er **én gjennomsnittlig årslønn i Norge**, hentet fra SSB. Et
budsjett på 1 800 milliarder blir da et felt på et par millioner merker,
altså for mange til å tegne. Løsningen er at feltet har en **eksplisitt,
alltid synlig målestokk**: ved lave oppløsninger er ett merke tusen lønninger,
og det står skrevet, aldri underforstått.

- Tegnes som `<canvas>` med devicePixelRatio-skalering. SVG med hundretusen
  noder dreper en telefon.
- Merket er et fylt kvadrat med hårfin luft rundt, ikke en sirkel. Kvadrater
  pakker uten hull, så feltets areal er proporsjonalt med beløpet. Det er
  hele poenget, og sirkler ville løyet om det.
- Feltet har alltid en tekstlig oppsummering ved siden av seg, både for
  skjermlesere og for den som bare vil ha tallet.
- Rekkefølgen på poster er størrelse, synkende. Det er regelen, og den er
  forklart på siden.

## Layout

Mobil er flaten. Alt tegnes for 360px først og får lov til å puste oppover.

- Én kolonne, maks 34rem lesebredde, sentrert. Ingen sidestilte paneler før
  det finnes plass til dem uten å krympe noe.
- `clamp()` på vertikale mellomrom. Varier rytmen: tett mellom et tall og
  forklaringen, generøst mellom to poster.
- Ingen kort. Ingen rutenett av like kort. Seksjoner skilles med luft og
  hierarki, ikke med rammer.
- Sticky målestokk i bunnen mens et felt er i visning, så leseren aldri
  mister hva ett merke betyr.

```css
--z-base: 0; --z-sticky: 10; --z-overlay: 20; --z-modal: 30;
```

## Motion

Sparsom og forklarende. Bevegelse brukes til én ting: å vise at et felt
fylles opp, fordi det å se det fylles er det som gir følelsen av mengde.

- Feltet tegnes progressivt når det kommer i visning. Ikke en fade, en
  faktisk oppfylling.
- Kurve: `cubic-bezier(0.22, 1, 0.36, 1)`. Ingen sprett.
- Alt innhold er synlig som standard. Animasjonen forbedrer noe som
  allerede står der, den avdekker det ikke. En avsløring som ikke utløses
  skal ikke kunne gi en tom side.
- `prefers-reduced-motion: reduce` tegner feltet ferdig med én gang.

## Accessibility

Fra PRODUCT.md, med de visuelle konsekvensene skrevet ut.

- Brødtekst 4,5:1, som `--ink` mot `--bg` klarer med god margin. `--muted`
  brukes aldri til brødtekst, bare til etiketter over 14px halvfet.
- Merkefeltet er dekorativt for skjermlesere (`aria-hidden`), og tallet det
  viser står som tekst rett ved siden av. Aldri bare i canvas.
- Fokusring: 2px `--primary` med 2px offset, aldri fjernet.
- Treffflate minst 44px.
- Testes i gråtoner før noe regnes som ferdig.
