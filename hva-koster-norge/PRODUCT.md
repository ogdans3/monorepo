# Product

## Register

brand

## Users

Folk uten økonomibakgrunn. Noen som har hørt at statsbudsjettet er på over
tusen milliarder kroner, ikke har noen som helst følelse for hva det tallet
betyr, og aldri kommer til å åpne en stortingsproposisjon for å finne ut av
det.

De kommer sannsynligvis fra en lenke i sosiale medier, på mobil, med et par
minutter til overs. De er ikke på jakt etter en database. De vil vite hva
pengene går til, om det er mye eller lite, og hva partiene er uenige om.

Jobben som skal gjøres: gjøre et ufattelig tall begripelig ved å oversette
det til noe leseren kjenner fra sitt eget liv, nemlig en vanlig månedslønn.

## Product Purpose

Statsbudsjettet er offentlig, men i praksis utilgjengelig. Det ligger som
tusenvis av sider proposisjoner og PDF-er, skrevet for folk som allerede kan
faget. Partienes alternative budsjetter er enda verre stilt: de finnes bare
som separate PDF-er hos hvert parti, i uforenlige formater, i én uke hver
november.

Denne siden gjør to ting ingen andre gjør samlet:

1. Regner statsbudsjettet om til én vanlig arbeiders lønnsslipp, så
   proporsjonene blir mulige å kjenne på.
2. Setter partienes alternative budsjetter opp mot dagens budsjett i samme
   enheter, så uenighetene blir synlige framfor påståtte.

Suksess er at noen som aldri har brydd seg om statsbudsjettet leser ferdig,
og etterpå kan si en setning om hvor pengene går som de ikke kunne si før.

## Brand Personality

Rolig og etterrettelig. Tre ord: **nøktern, presis, tydelig.**

Leseren skal stole på tallene før de reagerer på dem. Det betyr at
virkemidlene er stille selv når innholdet ikke er: tallene får gjøre jobben,
designet gjør dem lesbare. Ingen utropstegn, ingen røde piler, ingen
adjektiver som forteller leseren hva de skal føle.

Tonen er en kunnskapsrik venn som forklarer noe over kjøkkenbordet, ikke en
myndighet som informerer og ikke en avis som selger. Fagord forklares første
gang de brukes, eller unngås.

Den største risikoen med dette valget er at det blir kjedelig. Motgiften er
ikke pynt, men presisjon: en overraskende sann sammenligning slår enhver
animasjon.

## Anti-references

Alle fire er valgt bort eksplisitt.

- **Regjeringens egne sider.** Byråkratisk, grått, PDF-lenker og ord ingen
  bruker. Dette er hovedgrunnen til at prosjektet finnes, så å ligne på det
  er å tape på forhånd.
- **Partipolitisk kampanjeside.** Ingen partifarge får dominere en flate.
  Ingen slagord. Ingenting som antyder at siden heier på noen. Partier
  identifiseres med en konsekvent, nøytral koding, ikke med sine egne
  merkevarefarger brukt stort.
- **SaaS-dashbord.** Ingen KPI-kort med stort tall og liten etikett, ingen
  gradienter, ingen rutenett av like kort. Dette er den generiske
  AI-løsningen på «vis fram tall», og den er forbudt her.
- **Tabloid nyhetssak.** Ingen sjokkoverskrifter, ingen røde piler, ingen
  «dette vil overraske deg». Alvoret ligger i tallene.

## Design Principles

1. **Oversett, ikke oppsummer.** Et tall blir ikke forståelig av å bli
   gjentatt med færre siffer. Det blir forståelig av å bli gjort om til noe
   leseren allerede har en følelse for. Lønnsslippen er hovedgrepet, ikke en
   kuriositet på slutten.

2. **Hvert tall bærer sin kilde.** Siden handler om politikk, og den eneste
   forsvarsverket mot «dette er tull» er at leseren kan klikke seg til hvor
   tallet kommer fra. Et tall uten kilde skal ikke vises.

3. **Nøytralitet er en designoppgave, ikke en intensjon.** Rekkefølge,
   fargebruk, plassering og ordvalg tar parti selv om vi ikke mener å.
   Partier ordnes etter en regel som kan forklares, alle får samme visuelle
   vekt, og formuleringer sier hva forskjellen er framfor om den er bra.

4. **Mobil er flaten, ikke et tilfelle.** Leseren står på bussen. Alt som
   krever en bred skjerm for å gi mening er feil løsning, ikke et
   responsivt problem å fikse etterpå.

5. **Vær ærlig om usikkerhet.** Alternative budsjetter er ikke direkte
   sammenlignbare med vedtatt budsjett, tall avrundes, og noen poster er
   politisk omstridte i seg selv. Si det der det gjelder, framfor å late som
   presisjonen er høyere enn den er.

## Accessibility & Inclusion

WCAG 2.1 nivå AA som gulv, ikke som mål. Dette er ikke et valg: norsk
forskrift om universell utforming av IKT gjelder nettløsninger rettet mot
allmennheten, og denne er det.

- Kontrast på brødtekst minst 4,5:1. Ingen lysegrå tekst «for elegansens
  skyld».
- All informasjon som formidles med farge må også finnes i form, tall eller
  tekst. Dette gjelder særlig partikoding, der fargeblindhet ellers gjør
  grafene ubrukelige.
- `prefers-reduced-motion` respekteres overalt. Ingen bevegelse er
  nødvendig for å forstå innholdet.
- Innholdet skal gi mening opplest. Tall som bare fungerer visuelt, som en
  graf uten tekstlig oppsummering, er ikke ferdige.
- Språket er norsk bokmål, og enkelt. Lesbarhet er et
  tilgjengelighetsspørsmål her, ikke bare et stilspørsmål.
