# Notater — foredrag om AI

Råmateriale. Ikke en disposisjon ennå.

Sist oppdatert: 11.09.2026

---

## Tråd 1 — Eksplosjonen av software

> Imagetoolbox, dashboard og eksplosjon av software.
> Trenger jeg noe? Da lager jeg det istedenfor å lete og eventuelt betale.

Kjernen: terskelen for å lage har falt under terskelen for å lete. Før var
rekkefølgen søk → vurder → betal → lev med kompromisset. Nå er den *lag det*.

Egne eksempler på akkurat dette:

| Prosjekt | Hva det erstattet |
|---|---|
| **imagetoolbox.org** | nettsider med opplasting, reklame og uklare vilkår — her forlater filene aldri nettleseren |
| **master-dashboard** | en operatørkonsoll for 20 prosjekter, som ingen selger fordi ingen andre har akkurat denne serveren |
| **Sessions-fanen** (bygget 09.09.2026) | å ssh-e inn for å restarte tmux. Fantes ikke å kjøpe. Tok én kveld. |
| **file-drop** | WeTransfer |
| **hva-koster-norge** | fantes ikke |
| **pain-map**, **kvist**, **checkpost**, **duo-words** | alle sammen: «trengte det, fant det ikke, laget det» |

Poeng verdt å utvikle: dette er ikke bare *raskere*. Det endrer hva som er verdt
å lage i det hele tatt. Et verktøy med én bruker var før definisjonen på bortkastet
tid. Nå er det en kveld.

**Åpent:** er dette en historie om AI, eller om at *du* alltid har vært en som
bygger og AI bare fjernet friksjonen? Publikum vil lure. Verdt å ta stilling til.

---

## Tråd 2 — Ingen tenking lenger

> Ingen tenking lenger. Spør AI, trykker enter.
> Det man ikke bruker mister man. Når GPS og maps kom så ble et område av hjernen
> lite. Det samme kommer til å skje nå som vi ikke tenker lenger.

Dette er foredragets mørke halvdel, og den som gjør det til noe mer enn en
produktdemo.

Bildet som bærer: *det man ikke bruker, mister man.* GPS tok navigasjonen.
Hva tar dette?

Kandidater til «hva er det vi slutter å bruke»:
- Å holde et problem i hodet lenge nok til å forstå det
- Å tåle å ikke vite
- Å lese noe langt og vanskelig uten å be om et sammendrag
- Å skrive seg fram til hva man mener (ikke bare skrive ned det man alt mente)

**Spenningen som gjør foredraget interessant:** tråd 1 og tråd 2 motsier
hverandre. Du står der som beviset på at det virker — tjue prosjekter — og sier
samtidig at det tærer på noe. Ikke løs den spenningen for tidlig. Den *er*
foredraget.

---

## Tråd 3 — Hvor bra er AI egentlig?

> Hvor bra er egentlig AI? Er det produksjonsklart?
> Vise spillet, image toolbox, teorimester?

Demoer som er foreslått:

- **spillet** — ⚠️ *hvilket?* Finner det ikke i `~/git`. Ligger det på server 2?
- **imagetoolbox.org** — 20 verktøy, alt klientside, kan demonstreres live uten nett
- **teorimester.no** — ekte brukere, ekte innhold, ekte penger?

Kandidater til: dette er *virkelig* i produksjon, ikke en demo.

**Det sterkeste beviset er kanskje ikke et pent produkt, men et stygt problem.**
Eksempel fra Sessions-bygget: første forsøk hang for alltid fordi `claude
remote-control` stiller et engangsspørsmål i en terminal ingen sitter ved. Og
innloggingen sto fast fordi koden skriver ut `claude.com`, ikke `claude.ai`.
Ingen av de to feilene ble funnet ved å tenke. De ble funnet ved å kjøre det.
Det sier noe ærlig om hvor god AI er: god til å bygge, dårlig til å vite når
den tar feil.

**Åpent:** hva betyr «produksjonsklart» for deg i denne sammenhengen? At det
virker? At noen andre bruker det? At du tør la det stå uten tilsyn? Tre veldig
forskjellige påstander.

---

## Tråd 4 — Hvordan jeg har satt det opp

> Hvordan jeg har satt det opp. Egen server, egen pc, deploy keys, eget repo.
> Ingen nøkler.

Dette er svaret på spørsmålet alle i salen kommer til å ha: *tør du virkelig
la den kjøre fritt?* Poenget er ikke tillit, det er **sprengradius**. Den kan
gjøre hva den vil, fordi det den kan nå er avgrenset på forhånd.

Lagene, slik de faktisk står (sjekket 11.09.2026):

- **Egen maskin.** Alt kjører som `ai_user` på en server som ikke er PC-en din.
  Verste utfall er en server du kan bygge opp igjen, ikke arbeidsmaskinen din.
- **Egne repoer.** `phonemockup-ai`, `witchcary-ai`, `hvalen-minigolf-ai` — de
  har `-ai` i navnet fordi de *er* AI-ens repoer, ikke dine.
- **Egne deploy keys, én per repo.** Seks stykker i `~/.ssh`: `monorepo_`,
  `duo_words_`, `hvalen_minigolf_`, `id_ed25519_phonemockup`,
  `witchcary_ai_`, `server2_`. En nøkkel som lekker åpner ett repo.
- **Ingen API-nøkler.** `claude auth status` sier `claude.ai` / `firstParty` —
  abonnement over OAuth, ingen `ANTHROPIC_API_KEY`, ingen skynøkler, ingenting
  som kan bruke penger eller nå infrastruktur du ikke eier.

### Vær presis med «ingen nøkler»

Påstanden er sterk, men den er for bred slik den står, og noen i salen kommer
til å ta deg på den. Den *presise* versjonen er bedre og holder:

> Ingen tredjeparts API-nøkler. Ingenting som kan bruke penger. Ingenting som
> når noe jeg ikke eier.

For det finnes nøkler og hemmeligheter på boksen, og de er verdt å nevne selv
før noen spør:

- `.env` med `DASHBOARD_PASSWORD`, databasepassord osv.
- Dashboardet holder Docker-socketen, som er root-ekvivalent på verten. Det var
  hele grunnen til at Sessions-daemonen ble bygget som den ble — ikke gi den
  dør nummer to.
- Deploy keys *er* nøkler. De er bare små.

### To ting å rydde opp i før du viser dette fram

1. **`~/.ssh/config` sier at `id_ed25519` er «your normal personal key».**
   Standardruten `git@github.com:` går dit — og `witchecary` og
   `hvalen-minigolf` har remotes som treffer nettopp den, selv om begge har en
   egen nøkkel liggende. I dine egne arbeidsnotater står den samme nøkkelen
   beskrevet som *read-only*. De to beskrivelsene kan ikke begge stemme. Finn
   ut hvilken det er før du sier «deploy keys» fra en scene.
2. **`id_ed25519_phonemockup` ligger også i `~/git/`**, altså inne i katalogen
   AI-en jobber i, ikke bare i `~/.ssh`. Sannsynligvis en rest. Verdt å fjerne.

Ingen av de to velter poenget. De gjør det bare sant.

---

## Ting å sjekke før du sier det fra scenen

**GPS-påstanden.** Den fungerer retorisk, men den vanlige versjonen er en
sammenblanding av to ulike funn, og den blir ofte fortalt baklengs. Slik jeg
husker forskningen — sjekk dette selv, jeg har ikke kunnet verifisere kildene her:

- Maguire m.fl. (ca. 2000/2006) fant at London-taxisjåfører har *større* bakre
  hippocampus, og at den vokser med erfaring. Altså: å navigere selv *bygger*.
- Nyere arbeid (Dahmani & Bohbot, ca. 2020) fant at mye GPS-bruk henger sammen
  med svakere romlig hukommelse — men det er i stor grad korrelasjon.

Den presise formuleringen er altså ikke «GPS krympet en del av hjernen», men
«å navigere selv bygger den opp, og vi har sluttet å navigere selv». Sterkere
påstand, og den tåler et kritisk spørsmål fra salen.

**Motargumentet du kommer til å få.** Det samme ble sagt om skriftspråket
(Platon, *Faidros*: skriften vil gi «glemsel i sjelen»), om kalkulatoren, om
Google. Ha et svar klart på hvorfor dette er annerledes — eller innrøm at du
ikke vet. Begge deler er greit; å ikke ha tenkt på det er ikke det.

---

## Åpne spørsmål

- [ ] Hvilket spill?
- [ ] Hvem er publikum? Utviklere, ledere, eller folk flest? Avgjør alt.
- [ ] Hvor lenge varer det?
- [ ] Er det tre tråder eller ett foredrag? Bærende linje mangler foreløpig.
- [ ] Skal demoene være live eller opptak? Live er sterkere og kan feile.
- [ ] Er `id_ed25519` den personlige nøkkelen eller en read-only nøkkel? (tråd 4)
