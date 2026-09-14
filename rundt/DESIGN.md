# RUNDT — designkontrakt

## Utgangspunktet

Fargene er ikke valgt ved siden av spillet. De er plukket ut av spillets egne
skjermbilder med en pikselleser, og det er grunnen til at et skjermbilde limt
inn på sida ser ut som det hører hjemme der:

| Rolle | Hex | OKLCH | Hvor den kommer fra |
| --- | --- | --- | --- |
| `--grunn` | `#0b2a40` | `0.2744 0.0544 243.4` | menybakgrunnen i spillet |
| `--grunn-2` | `#103c51` | `0.3372 0.0595 233.5` | lyset midt i den bakgrunnen |
| `--grunn-3` | `#174e6a` | `0.4022 0.0730 235.3` | kantene på knappene i menyen |
| `--kant` | `#5f7f93` | `0.5795 0.0477 236.1` | kant på skjemafelt, 3,5:1 mot grunnen |
| `--kritt-svak` | `#7e9fb4` | `0.6852 0.0479 236.3` | nummeret på en låst bane, 5,3:1 |
| `--skilt` | `#ffc32b` | `0.8489 0.1645 84.5` | tittelen på startskjermen |
| `--skilt-dyp` | — | `0.6300 0.1280 74.0` | den harde kanten under knappene |
| `--gress` | `#5ed78f` | `0.7917 0.1505 154.7` | spillflaten |
| `--kjegle` | `#ff5638` | `0.6797 0.2100 32.4` | en av bilene. Brukes bare til feil |
| `--kritt` | `#eaf3f8` | `0.9588 0.0117 231.7` | brødtekst |
| `--kritt-dempet` | `#9fc0d2` | `0.7894 0.0438 231.9` | sekundærtekst, 7,7:1 mot grunnen |

Fargestrategien er **committed**: én mettet flate bærer hele sida, og gult gjør
alt arbeidet oppå den. Ingen andre aksentfarger slipper til. `--kjegle` er
ikke en aksent, den er en feilmelding.

Kontrast er sjekket, ikke antatt, og målt i nettleseren på ferdig tegnet side.
Laveste forhold på tekst er 5,3:1. Kanten rundt et skjemafelt er en
komponentkant og ligger på 3,5:1, over kravet på 3:1 — veibanefargen fra
spillet så helt grei ut der og lå på 1,7:1, som er nettopp derfor dette måles.

## Typografi

Én familie: **Archivo**, variabel, selvhostet, bare latin-utsnittet (90 kB).
Kontrasten kommer fra bredde­aksen, ikke fra en font til:

- Ordmerke: `wght 900`, `wdth 122`
- Overskrifter: `wght 800`, `wdth 108`, `letter-spacing -0.03em`
- Brødtekst: `wght 450`, `wdth 100`

Archivo fordi den har skiltslektskap uten å være en pastisj, og fordi den
holder seg lesbar i 800 på 4,4rem. Ikke Inter, ikke Poppins, ikke Montserrat.

Displaytak: `clamp(...)` slutter på 4,4rem. Linjelengde: 62–66 tegn i brødtekst.

## De to sitatene fra spillet

Sida har nøyaktig to visuelle sitater, og de er de eneste effektene som finnes:

1. **Ordmerket.** Gult med en hard, uskarp skygge tre piksler under —
   nøyaktig sånn tittelen står på startskjermen.
2. **Knappen.** En flate med en hard kant under seg som synker ned når du
   trykker. Det er spillets egen knapp, inkludert den fire piksler lange
   nedturen.

Legger du til en tredje effekt, blir de to første til pynt. Ikke gjør det.

## Den ene bevegelsen

En gul strek tegner seg selv én gang under ingressen og ender i en pil som
peker på skjemaet. Den er der fordi *å tegne en strek* er hele spillet — den
er en demonstrasjon, ikke en dekorasjon.

Alt annet som beveger seg er knappetrykk. 90–220 ms, ease-out, ingen sprett.
`prefers-reduced-motion: reduce` fjerner både strektegningen og nedturen på
knappen, og streken vises ferdig tegnet i stedet for ikke i det hele tatt.

## Regler som ikke er til forhandling

- **Ingen kort.** Banene er rader med hårstrek mellom. Skjermbildene er
  figurer, ikke kort. En seksjon som blir til tre like bokser med ikon,
  overskrift og tekst er sjangerrefleksen, ikke denne sida.
- **Ingen telefonramme rundt skjermbildene, og ingen skråstilling.** De er
  allerede bilder av en telefon.
- **Nummereringen 01–07 er spillets egen.** Banevelgeren teller `01 / 07`, og
  rekkefølgen er ekte: du låser opp den neste med den forrige. Nummerer ikke
  noe annet på sida.
- **Ingen gradienttekst, ingen glassflater, ingen fargede kantstriper.**
- **Ingen eksterne ressurser.** Skrift, bilder og skript ligger i imaget.
  Innholdspolicyen i `src/app.js` er `default-src 'none'` og slipper bare
  `'self'` gjennom. Legger du til noe utenfra, er det den linja som sier nei
  først, og det er meningen.
- **Skjemaet virker uten JavaScript.** Det er et vanlig `method="post"`-skjema
  med en `action`, og serveren svarer med en side når det kommer inn som
  skjemadata. JavaScript sparer deg for en sidelasting, det er alt det gjør.

## Skjermbildene

Seks skjermbilder, hentet fra spillet og konvertert til webp i to bredder (1179 og
590) med `srcset`. Det store i heisen lastes med `fetchpriority="high"`,
resten med `loading="lazy"`. Alle har alt-tekst som beskriver hva som faktisk
skjer på skjermen, ikke «skjermbilde fra spillet».

Rada med fire er en hylle du drar på under 62rem og en forskjøvet rad over.
Forskyvningen er der for at fire like høye bilder ikke skal lese som et
kortrutenett.

## Sidas oppbygning

Heis, regler, baner, skjema, bunn. Fem ting. Skjemaet står i heisen fordi det
er det sida skal, og en gang til nederst fordi noen leser hele veien ned
først.
