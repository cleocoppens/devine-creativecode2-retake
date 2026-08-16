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

## Concept: ECHO-9 — Ontsnap uit het Geheugen

*Nieuw concept, losstaand van het vorige (Meridian — De Laatste Nacht van de Kloktoren).*

### Thema en setting

Jij bent een onderzoeker die via een neurale link is ingelogd op **ECHO-9**, een verouderde AI-kern in een verlaten onderzoeksstation. Tijdens het onderhoud loopt er iets fout: het systeem start een **kernel wipe** — een volledige zelfwissing — en jouw bewustzijn zit nog vast in het geheugen van de AI. Je moet drie geheugensectoren doorkruisen, verspreide datafragmenten reconstrueren tot een geldige escape-key, en die uitvoeren via het terminalcommando `escape.exe` voordat de wipe voltooid is.

- **Win-state**: de correcte escape-key wordt op tijd ingevoerd → succesvolle "uitlog" animatie, tijd wordt opgeslagen in het leaderboard.
- **Lose-state**: de timer bereikt 0 voordat de key compleet is → glitch/wipe-animatie, "GEHEUGEN GEWIST" scherm, optie om opnieuw te proberen.

Visuele stijl: donkere terminal-esthetiek (near-black achtergrond, monospace accenten, neon cyaan/magenta highlights), glitch- en scanline-effecten, subtiele CRT-flikkering — dit geeft veel ruimte voor CSS-animaties en micro-interacties die passen bij het digitale thema.

### Structuur — 3 sectoren (kamers)

1. **Sector Alpha — Login Terminal**
   Introductie/storytelling. Speler moet een Caesar-cipher decoderen (aanwijzing verstopt in omgevingstekst/log-bestanden) en het wachtwoord invoeren via een formulier om toegang te krijgen tot de kern.

2. **Sector Beta — Corrupted Files**
   Twee uitdagingen:
   - Een memory-match puzzel (fragmenten/iconen aanklikken in juiste volgorde) die een verborgen afbeelding of code onthult.
   - Een binair-naar-tekst puzzel: speler krijgt een binaire code en typt het gedecodeerde woord in een formulierveld.

3. **Sector Gamma — Firewall Core**
   Twee uitdagingen:
   - Een circuit-reroute puzzel: nodes in de juiste volgorde aanklikken om stroom te herstellen (visuele glow-feedback per stap).
   - Een combinatieslot (numeriek formulier) waarvan het getal verborgen zit via een stenografie-achtige aanwijzing (bv. gemarkeerde letters/cijfers in een logbestand).

   Afsluiter: alle verzamelde fragmenten worden gecombineerd tot de escape-key, in te voeren in de terminal (`escape.exe`) om te winnen.

### Hintsysteem (optioneel, wel toegevoegd)

- Speler start met **3 hints**.
- Elke hint kost **30 seconden** van de resterende tijd (tijdstraf) in plaats van een harde limiet, zodat spelers zelf de afweging maken.
- Hint verschijnt met een korte `setTimeout()`-vertraging ("decoding hint...") voor extra spanning/feedback.

### Leaderboard

- Bij winst: formulier voor het invoeren van een naam/initialen.
- Beste tijden (top 5-10) worden opgeslagen en getoond via `localStorage`.
- Optioneel: voortgang (huidige sector/opgeloste puzzels) tussentijds opslaan zodat een pagina-refresh niet meteen alles reset.

### Technische invulling per vereiste

| Vereiste | Toepassing in ECHO-9 |
|---|---|
| DOM-manipulatie | Tonen/verbergen van sectoren, clues, feedbackberichten, voortgangsindicator |
| Eventhandlers | Klik-events op nodes/fragmenten, submit-events op formulieren, keyboard input in terminal |
| Alleen arrow functions | Alle event handlers en helperfuncties als arrow functions |
| Formulieren | Wachtwoord-invoer, binaire code-invoer, combinatieslot, naam voor leaderboard |
| localStorage | Array van beste tijden (leaderboard), optioneel voortgang |
| `setInterval()` | Countdown timer (kernel wipe aftellen) |
| `setTimeout()` | Vertraagde feedback bij foute/juiste invoer, hint-onthulling, overgangsanimaties tussen sectoren |
| CSS-animaties | Glitch/flicker-effecten, scanlines, pulse bij correcte input, shake bij foute input |
| Micro-interacties | Hover/press states op knoppen en nodes, glow-feedback bij voortgang, timer die van kleur verandert bij tijdsdruk (bv. rood + pulse onder 60 seconden) |
