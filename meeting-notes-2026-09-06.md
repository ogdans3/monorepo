# Møtenotat — 06.09.2026

Gjennomgang etter runde 4 (MVP-kuttet). Under er forberedelsen: hva som er
avgjort i skjermene, hva som fortsatt står åpent, og hvor dokumentasjonen
har kommet i utakt med utkastene. Beslutninger skrives inn under hvert punkt
underveis.

Notatet fra 19.08 ble aldri fylt ut. Runde 4 finnes, så det ble tatt
beslutninger i det møtet som ikke står noe sted. Verdt to minutter å
rekonstruere før vi går videre.

---

## Siden sist: hva runde 4 faktisk kuttet

Runde 3 hadde 31 skjermtilstander, runde 4 har 36 — men innholdet er
smalere, ikke bredere. Det som er ute:

- **Hele mangeveis-flyten** (08 i runde 3). Igjen står toveis og treveis.
- **Onboarding-slidene** («Slik funker det», 02a/02b).
- **Søkefeltet på Oppdag.** Søk er nå en egen fane.
- **Sveipekortene.** Oppdag er en Tise-inspirert collage du scroller i.

Og det som er nytt:

- **Fem faner** i bunn-nav: Oppdag · Søk · Legg ut · Bytter · Profil.
  Designbriefen spesifiserte fire (Discover · Likes · Trades · Profile).
- **08-flyt for å trekke seg etter godkjenning**, med en sluttilstand vi ikke
  har beskrevet noe annet sted: «Ikke mulig, en ting er sendt».
- **07i–07k: treveis uten fasilitering**, lagt inn som et alternativ ved
  siden av den fasiliterte treveis-flyten.

---

## 1. Hvordan sier man «jeg vil ha denne»?

Dette er dagens viktigste punkt, og jeg vil ta det først.

Hele match-modellen er bygget på at et sveip er en rettet kant: *A vil ha Bs
ting og tilbyr sin egen*. Uten den kanten finnes det ingen graf og ingen
sykel å finne.

I runde 4 er sveipekortene borte, og ønsket uttrykkes gjennom **«♥ Vil
bytte» inne i en kontekstmeny som åpnes ved langtrykk**. Menyen inneholder
fire valg: Vil bytte, Ikke vis meg slike, Se profil, Rapporter.

Det betyr at produktets mest sentrale handling nå ligger bak en gest uten
synlig affordans. Tise-collagen er hentet fra en app der kjernehandlingen er
å *kjøpe*, som skjer inne på detaljsiden — ikke fra listen. Vi har flyttet
listen dit, men beholdt kravet om at signalet må komme i volum, siden
kjeder bare oppstår når mange nok har uttrykt nok ønsker.

**Å avgjøre:** ligger «vil bytte» i collagen, på detaljsiden (04), eller
begge steder? Hvis den skal ligge i collagen, må den være synlig.

**Min anbefaling:** synlig hjerte på hvert kort i collagen, og
kontekstmenyen beholdes for det sjeldne (skjul, rapporter). Vi trenger
volum av signaler mer enn vi trenger et rent rutenett.

**Besluttet:**

---

## 2. Fasilitering: er vi mellommann eller ikke?

Runde 4 legger 07a–07f (fasilitert treveis, med «sending») og 07i–07k
(treveis uten fasilitering) side om side som alternativer. Det er ikke to
design, det er to forskjellige selskaper.

Spørsmålet ble reist 31.07 og står fortsatt ubesvart: *hvis pengene går
gjennom oss, er vi ansvarlige for frakten?*

Konsekvensene henger sammen:

| | Fasilitert | Ikke fasilitert |
|---|---|---|
| Frakt og betaling | I appen, vi tar en cut | Partene ordner selv |
| Ansvar ved tap/skade | Sannsynligvis vårt | Partenes |
| Inntektsmodell | Gebyr per handel er mulig | Må komme fra annonser eller kontaktinfo |
| MVP-kompleksitet | Vipps, fraktetiketter, mellomlegg | Chat og en avtale |

**Min anbefaling:** ikke fasilitert i MVP. Det fjerner et
ansvarsspørsmål vi ikke har avklart juridisk, og runde 3 sin
mangeveis-flyt — der Vipps og mellomlegg lå — er allerede kuttet.

**Besluttet:**

---

## 3. Navnet

Fortsatt uavklart etter fem uker, og det er nå en aktiv motsigelse på tvers
av mappene:

- `git/swappify/DESIGN.md` heter «# Swappify»
- alle fire skjermutkast sier «Swaply»
- `swapply-design/CLAUDE.md` slår fast at produktet heter Swaply med én p,
  og at en tidligere omskriving til «Swappify» var feil og er reversert

Dette er billig å bestemme og dyrt å utsette: domene, App Store-navn,
dyplenker og invitasjonslenker henger alle på det.

**Min anbefaling:** Swaply. Det er det som står i utkastene, det er kortere,
og det er allerede slått fast som produktnavn ett sted.

**Besluttet:**

---

## 4. Inntektsmodell

Fire ideer ble notert 31.07: annonser hvert 10. sveip, admin-gebyr per
handel, betale for å låse opp kontaktinfo, og promotering av egne ting.

**Ingen av dem har dukket opp i noen av de fire rundene med skjermer.**

Én av dem er dessuten avhengig av noe som ikke lenger finnes: «annonse hvert
10. sveip» forutsetter et sveip. Med collage må den ideen enten bli et kort
i rutenettet eller falle bort.

**Å avgjøre:** skal noe av dette inn i MVP i det hele tatt, eller er MVP
gratis og uten inntekt? Hvis det siste, si det eksplisitt, så slutter det å
være et åpent punkt i hver runde.

**Besluttet:**

---

## 5. Punktet uten retur

08-flyten introduserer «Ikke mulig, en ting er sendt». Det er en regel vi
ikke har skrevet ned: fra hvilket øyeblikk kan man ikke lenger trekke seg?

`DESIGN.md` beskriver i dag at en av-godkjenning alltid ruller byttet
tilbake til `pending`. Runde 4 sier at det slutter å gjelde når noen har
sendt. Det er riktig, men det trenger en presis definisjon — hvem
registrerer at noe er sendt, og hva skjer med de andre i en treveis når én
har sendt og én vil trekke seg?

**Besluttet:**

---

## 6. Samtale: felles eller per person?

Har vinglet mellom rundene. Runde 3 gikk til separate samtaler per person i
større bytter, runde 4 viser «07f Samtale, alle tre» (felles) og i tillegg
«07k Chat for byttet» i alternativflyten. `DESIGN.md` sier felles tråd.

**Å avgjøre:** bekreft felles tråd, så er den ute av spill.

**Besluttet:**

---

## Dokumentasjonen henger etter

`DESIGN.md` er nå bak utkastene på minst fem punkter. Den beskriver
fortsatt:

1. **Tinder-sveip** som v1-interaksjon. Runde 4 er collage.
2. **Fritekstsøk på hovedsiden.** Søk er nå egen fane.
3. **Kjeder opp til 5 hopp** med syklussøk. Mangeveis er kuttet fra MVP, så
   dybden er reelt 3.
4. **Ingen BankID.** Modellen sier e-post *eller* telefon ved claim. Runde 3
   og 4 promptar BankID ved første godta.
5. **Av-godkjenning ruller alltid tilbake.** Runde 4 har et punkt uten retur.

Så lenge den er utdatert er den ikke til å bygge etter, og «Next
steps»-listen nederst i den har ikke startet: `git/swappify` inneholder fire
markdown-filer og ingen kode. Etter fem uker og fire designrunder er det
verdt å si høyt om neste steg er runde 5 eller første linje kode.

---

## Aksjonspunkter

- [ ] Fyll inn beslutningene over i dette notatet under møtet.
- [ ] Rekonstruér hva som ble bestemt 19.08, eller stryk notatet.
- [ ] Oppdater `DESIGN.md` til å stemme med den runden vi lander på.
- [ ] Bestem: runde 5, eller monorepo-scaffold og skjema.
