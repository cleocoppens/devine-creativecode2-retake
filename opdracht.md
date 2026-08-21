# Opdracht: Escape Room

Bouw een webbased escape room-ervaring die uitdagingen, exploratie en storytelling combineert. Spelers moeten zich een weg naar buiten banen voordat de tijd om is. Wanneer de tijd op is, verliest de speler. Het succesvol voltooien van alle uitdagingen leidt tot ontsnapping en overwinning.

## Vereisten

- Kies een origineel thema en setting
- Implementeer een countdown timer die de gameplay spanning geeft
- Creëer win (ontsnapt op tijd) en verlies (tijd is op) states
- Ontwerp interactieve uitdagingen die passen bij je thema
- Jij bepaalt de omvang: één kamer of meerdere kamers, 3 uitdagingen of 10 uitdagingen
- Sla de beste tijden op met localStorage voor een leaderboard
- Optioneel: implementeer een hintsysteem (met tijdstraffen of beperkte hints)
- Je layout is "Devine worthy": hoewel dit geen designvak is, streef je naar een layout en kleurenschema die de gebruikerservaring verbeteren
- Voeg animaties en micro-interacties toe die reageren op gebruikersacties (feedback bij ontdekkingen, timerwaarschuwingen, onthullingsmomenten)

## Technische vereisten

- DOM-manipulatie
- Eventhandlers
- Alleen arrow functions gebruiken
- Correct gebruik van formulieren
- localStorage (beste tijden opslaan, optioneel voortgang opslaan)
- `setInterval()` (countdown timer)
- `setTimeout()` (vertraagde feedback, animaties)
- CSS-animaties
- Micro-interacties
- Externe libraries of frameworks zijn niet toegelaten
- Project wordt online gehost (Combell)

---

## Concept: De Verboden Kluis

*Geïmplementeerd concept — vervangt het eerdere ECHO-9-ontwerp.*

### Thema en setting

Jij bent leerling-archivaris aan een universiteitsbibliotheek. Terwijl je 's avonds laat een oud manuscript terugbrengt, valt de deur van de **Verboden Sectie** achter je in het slot. Het eeuwenoude bewakingssysteem van het archief start een **zuiveringsprocedure**. Vier beveiligingslagen scheiden je van de uitgang — ontcijfer ze allemaal voor de tijd om is, of blijf voor altijd onderdeel van de collectie.

- **Win-state**: de Meestercode wordt op tijd samengesteld en ingevoerd → de kluisdeur glijdt open (geanimeerd), tijd wordt opgeslagen in het leaderboard.
- **Lose-state**: de timer bereikt 0 → "Gezuiverd"-scherm met zwaaiende kettingen, optie om opnieuw te proberen.

Visuele stijl: gotische archief/bibliotheek-esthetiek (perkament, koper/goud, kaarslicht en Baskerville-typografie). Elk scherm heeft een eigen sfeerfoto (`images/`), gecombineerd met CSS-gradients voor leesbaarheid: een gotische hal met poort op intro en leaderboard, een fakkelgang tijdens het spel, een mijnschacht bij verlies, en een maanverlichte binnenplaats bij winst. Het manuscript en de introscroll gebruiken een perkamentfoto als textuur.

### Structuur — 4 beveiligingslagen (één kluis)

1. **Laag I — Het Coderadeslot**: drie letterwielen instellen op een 3-lettercode. De code zit verstopt als acrostichon in de flavourtekst (eerste letter van elke zin).
2. **Laag II — Het Waszegelarchief**: vier fragmenten koppelen aan het juiste adellijke huis op basis van het beschreven wapendier; elk huis levert een cijfer.
3. **Laag III — De Manuscriptvertaling**: een geheimschrift (symbool-naar-letter legenda) ontcijferen tot een woord, ingevoerd via een formulier.
4. **Laag IV — De Finale Reeks**: de Meestercode combineren uit fragmenten van de vorige drie lagen volgens een expliciete formule, en invoeren om de kluis te openen.

### Hintsysteem (optioneel, wel toegevoegd)

- Speler start met **3 hints**.
- Elke hint kost **60 seconden** van de resterende tijd (tijdstraf), zonder harde limiet op het aantal pogingen.
- Hint verschijnt in een paneel onder de huidige laag, met een shake-microinteractie op de hintknop.

### Leaderboard

- Bij winst: formulier voor het invoeren van een naam.
- Beste tijden (top 10) worden opgeslagen en getoond via `localStorage`.
- Voortgang (verzamelde fragmenten per laag) is zichtbaar in de zijbalk tijdens het spel.

### Technische invulling per vereiste

| Vereiste | Toepassing in De Verboden Kluis |
|---|---|
| DOM-manipulatie | Renderen van elke laag, voortgangsindicator (dots), aanwijzingen-zijbalk, leaderboard |
| Eventhandlers | Klik-events op wielen/zegels, submit-events op formulieren |
| Alleen arrow functions | Volledige `script.js` is één IIFE (`(() => {...})()`) met uitsluitend arrow functions |
| Formulieren | Manuscriptvertaling, Meestercode-invoer en naam-voor-leaderboard via `FormData` + `Object.fromEntries()` |
| localStorage | Array van beste tijden (leaderboard) |
| `setInterval()` | Countdown timer (zuiveringsprocedure aftellen) |
| `setTimeout()` | Vertraagde overgang naar volgende laag, hersteltijd na foute invoer, hint-shake |
| CSS-animaties | Fakkelflikkering, pulserende voortgangsstip, shake bij foute input, wiegende kettingen, kluisdeur die open schuift |
| Micro-interacties | Hover/press states op knoppen en zegelkaarten, glow bij voortgang, timer die rood pulseert onder 60 seconden |
