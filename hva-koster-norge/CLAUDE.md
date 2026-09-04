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
- **`.num` (tabulære sifre) hører til i kolonner, ikke i setninger.** Tabulær
  spalting gir også desimalkomma full siffer-bredde, så «71,3 %» inne i en
  setning rendres som «71 , 3 %» og leses som en skrivefeil. Bruk klassen på
  displaytall og kolonner, aldri i brødtekst.
- **Kvalitative påstander utledes fra tallet de står ved.** «Staten bruker
  nesten like mye som...» var hardkodet ved siden av et regnet forhold som var
  71 %. En slik setning er en feil som venter på året tallet flytter seg. Og
  utled hele setningen, ikke to ord: «mer enn» og «omtrent like mye som» tar
  ulike setningsrammer.
- **Bevegelse skal aldri skjule formen.** Figurene tegnet seg først selv med
  `stroke-dashoffset`, så formen var delvis borte en tredel av hver loop, og et
  skjermbilde fanget pulslinja halvtegnet. Animer skala eller opasitet på noe
  som allerede er fullt synlig.
- **Se figurene store før du tror de er ferdige.** Tre av åtte var feil ved
  første forsøk: skjoldet med kors leste som medisinsk, ikke forsvar. De er
  uleselige å vurdere på 48px, og `/tmp/e2e/figurer.mjs` rendrer alle sammen
  på 120px ved siden av hverandre.
- **Mobil er flaten.** 360px først. Alt som krever bred skjerm for å gi
  mening er feil løsning, ikke et responsivt problem å fikse etterpå.
- **Ingen kort, ingen rutenett av like kort, ingen liten sperret versal
  over hver seksjon.** Alle tre er utpekt som mettet AI-grammatikk i
  impeccable-ferdigheten, og seksjonene skilles med luft og hierarki.

- **Dashbordet oppdager bare mapper direkte i `/home/ai_user/git/`.** Dette
  prosjektet ligger i monorepoet, så det finnes en symlink
  `git/hva-koster-norge -> monorepo/hva-koster-norge`. Uten den er prosjektet
  usynlig for dashbordet uansett hvor riktig Dockerfile og `.dashboard.yaml`
  er. Samme mønster som checkpost og image-tools.
- **`HOST=0.0.0.0` i Dockerfile er ikke pynt.** Dashbordet når containeren
  over `aicentral`-broen, ikke over loopback, så en server bundet til
  127.0.0.1 er uåpnelig derfra. Feilen ser ut som et bygg som gikk fint og en
  side som ikke laster.
- **`data/` er i `.dockerignore`.** Kildedokumentene hører hjemme i repoet,
  men aldri i imaget: siden leverer de tolkede tallene, ikke PDF-ene.

## Verify

```sh
pnpm test && pnpm check && pnpm build
```

Skjermbilde på ekte mobilbredde er en del av verifiseringen, ikke en ekstra
runde: feilen med at alle feltene ble like store var usynlig i koden og
åpenbar i et bilde på 390px.
