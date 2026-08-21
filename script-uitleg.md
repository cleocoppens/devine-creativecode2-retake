# Uitleg script.js — De Verboden Kluis

Dit document bevat de volledige JavaScript-code van het spel, opgedeeld per onderdeel, telkens met uitleg erbij. De code in `script.js` zelf bevat geen commentaar meer — deze uitleg staat hier apart.

## Instellingen

Deze constanten bepalen de spelregels. Ze staan bovenaan zodat je de moeilijkheidsgraad (tijd, strafpunten, ...) op één plek kan aanpassen.

```js
const TOTAL_TIME = 180; // countdown duur in seconden (3 minuten)
const HINT_PENALTY = 60; // seconden die een hint van de resterende tijd afhaalt
const LB_KEY = "verbodenKluisLeaderboard"; // localStorage-sleutel voor het leaderboard
```

- `TOTAL_TIME`: de countdown duurt 180 seconden (3 minuten).
- `HINT_PENALTY`: elke hint kost de speler 60 seconden van de resterende tijd.
- `LB_KEY`: de naam van het "vakje" in de browseropslag (localStorage) waar het leaderboard bewaard wordt.

## Spelstatus

Eén groot object dat bijhoudt hoever de speler staat.

```js
const state = {
  layer: 0,
  timeLeft: TOTAL_TIME,
  timerId: null,
  hintsLeft: 3,
  fragments: ["", "", ""],
  elapsed: 0,
};
```

Door alle spelgegevens in één object te bundelen (in plaats van losse variabelen), kunnen alle functies dezelfde "bron van waarheid" lezen en aanpassen zonder dat we alles als parameter moeten doorgeven.

- `layer`: welke laag we nu spelen (0 t/m 3, dus laag 1 t/m 4 voor de speler).
- `timeLeft`: resterende seconden op de klok.
- `timerId`: referentie naar `setInterval`, nodig om de timer te kunnen stoppen.
- `hintsLeft`: aantal hints dat nog gebruikt mag worden.
- `fragments`: opgeloste codes per laag (I t/m III), gebruikt om de Meestercode in laag 4 te bouwen.
- `elapsed`: verstreken seconden sinds de start, wordt de eindtijd bij winst (en het leaderboard-resultaat).

## Hulpfuncties

### showScreen

```js
const showScreen = (id) => {
  const $screens = document.querySelectorAll(".screen");
  $screens.forEach(($screen) => $screen.classList.remove("active"));
  const $target = document.querySelector(`#${id}`);
  $target.classList.add("active");
};
```

Wisselt van scherm door de `active` class te verplaatsen. Alle schermen (intro, spel, win, verlies, leaderboard) staan gewoon allemaal in de HTML; enkel het scherm met de class `active` is zichtbaar (dat wordt geregeld via CSS). Deze functie haalt `active` overal weg en zet die daarna alleen op het scherm met het opgegeven id.

### shuffle

```js
const shuffle = (arr) => {
  const copy = arr.slice();
  copy.sort(() => Math.random() - 0.5);
  return copy;
};
```

Husselt een array in willekeurige volgorde (Fisher-Yates-achtig, maar met een simpele sort-truc: elk paar elementen wordt met 50% kans omgewisseld). Er wordt gewerkt op een kopie (`slice`) zodat de originele array niet wordt aangepast — dat voorkomt bugs elders in de code.

### pad

```js
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
```

Zet een getal om naar 2 cijfers, bv. `5` → `"05"`. Wordt gebruikt om de timer er als "04:59" i.p.v. "4:59" te laten uitzien.

### escapeHtml

```js
const escapeHtml = (str) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
```

Maakt tekst veilig om via `innerHTML` te tonen (bv. de speler-ingevoerde naam in het leaderboard). Vervangt HTML-speciale tekens door hun entity, zodat een naam als `<img src=x onerror=...>` als platte tekst verschijnt in plaats van als uitvoerbare HTML.

### formatTime

```js
const formatTime = (secs) => {
  const s = secs < 0 ? 0 : secs;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${pad(m)}:${pad(r)}`;
};
```

Zet seconden om naar MM:SS voor de timer en het leaderboard. Negatieve waarden worden naar 0 geknepen zodat de klok nooit "-1:23" toont.

### flashSuccess

```js
const flashSuccess = () => {
  const $flash = document.querySelector("#success-flash");
  $flash.classList.remove("play");
  setTimeout(() => $flash.classList.add("play"), 10);
};
```

Laat de gouden flits even opnieuw afspelen bij een correcte oplossing. Truc: eerst de class `play` weghalen en dan pas (na een timeout van 10ms) weer toevoegen. Zo "ziet" de browser een echte wijziging en herstart de CSS-animatie, ook als de flits kort daarvoor al speelde.

### playShake

```js
const playShake = ($el) => {
  $el.classList.remove("shake");
  setTimeout(() => $el.classList.add("shake"), 10);
  setTimeout(() => $el.classList.remove("shake"), 500);
};
```

Laat een element kort schudden (foutfeedback). Zelfde truc als `flashSuccess`: class weghalen, terugzetten na 10ms zodat de animatie opnieuw start, en na 500ms weer weghalen zodat een volgende fout ook weer kan schudden.

## Timer

### updateTimerDisplay

```js
const updateTimerDisplay = () => {
  const $timerDisplay = document.querySelector("#timer-display");
  $timerDisplay.innerHTML = `<span class="timer-label">Tijd tot zuivering</span>${formatTime(state.timeLeft)}`;
  $timerDisplay.classList.toggle("warning", state.timeLeft <= 60);
};
```

Ververst de klok in de header en zet de rode "warning"-stijl aan zodra er nog maar 60 seconden of minder over zijn. `classList.toggle(klasse, voorwaarde)` voegt de klasse toe als de voorwaarde `true` is, en haalt ze weg als ze `false` is. Zo hoeven we niet zelf if/else te schrijven om de klasse te zetten/verwijderen.

### startTimer

```js
const startTimer = () => {
  state.timerId = setInterval(() => {
    state.timeLeft = state.timeLeft - 1;
    state.elapsed = state.elapsed + 1;
    updateTimerDisplay();
    if (state.timeLeft <= 0) {
      stopTimer();
      loseGame();
    }
  }, 1000);
};
```

Start de countdown: elke seconde gaat `timeLeft` omlaag. `setInterval` roept de meegegeven functie elke 1000ms (1 seconde) opnieuw aan, tot we hem stoppen met `clearInterval` (zie `stopTimer`).

### stopTimer

```js
const stopTimer = () => {
  if (state.timerId) {
    clearInterval(state.timerId);
  }
  state.timerId = null;
};
```

Zet de lopende timer stil. `clearInterval` heeft het id nodig dat `setInterval` teruggaf; dat id staat bewaard in `state.timerId`. Nadien zetten we het terug op `null` zodat we niet per ongeluk een al-gestopte timer nog eens proberen te stoppen.

### applyPenalty

```js
const applyPenalty = (secs) => {
  state.timeLeft = state.timeLeft - secs;
  if (state.timeLeft < 1) state.timeLeft = 1;
  updateTimerDisplay();
  const $timerDisplay = document.querySelector("#timer-display");
  $timerDisplay.classList.add("warning");
  setTimeout(() => {
    if (state.timeLeft > 60) $timerDisplay.classList.remove("warning");
  }, 700);
};
```

Trekt de tijdstraf van een hint af van de klok. De tijd mag nooit onder 1 seconde zakken (anders zou de speler meteen verliezen op het moment dat hij een hint vraagt). Nadien knippert de klok even rood ("warning") als visuele bevestiging van de straf, en verdwijnt die kleur na 700ms weer als er nog genoeg tijd over is.

## Voortgang + aanwijzingen

### LAYER_NAMES

```js
const LAYER_NAMES = ["Coderadepuzzel", "Waszegelarchief", "Manuscriptvertaling", "De Finale Reeks"];
```

Namen van de vier lagen, gebruikt als label boven elk puzzelscherm.

### renderProgress

```js
const renderProgress = () => {
  const $dots = document.querySelector("#progress-dots");
  $dots.innerHTML = "";
  LAYER_NAMES.forEach((_, i) => {
    const $dot = document.createElement("div");
    if (i < state.layer) {
      $dot.className = "dot done";
    } else if (i === state.layer) {
      $dot.className = "dot current";
    } else {
      $dot.className = "dot";
    }
    $dots.appendChild($dot);
  });
};
```

Bouwt de rij voortgangsstippen in de header. Voor elke laag wordt een "dot" (bolletje) getekend: `done` voor lagen die al opgelost zijn, `current` voor de laag waar de speler nu op zit, en een lege class voor lagen die nog moeten komen. Zo ziet de speler in één oogopslag hoever hij staat. De lijst wordt eerst leeggemaakt, anders stapelen de bolletjes zich op bij elke re-render.

### renderClues

```js
const renderClues = () => {
  const $list = document.querySelector("#clues-list");
  $list.innerHTML = "";
  const labels = ["Laag I", "Laag II", "Laag III"];
  labels.forEach((label, i) => {
    const $item = document.createElement("div");
    $item.className = "clue-item";
    const val = state.fragments[i];
    const valueClass = val ? "clue-value" : "clue-value unknown";
    $item.innerHTML = `<span class="clue-label">${label}</span><span class="${valueClass}">${val || "??????"}</span>`;
    $list.appendChild($item);
  });
};
```

Toont de tot nu toe verzamelde fragment-codes in de zijbalk. Voor elke laag tonen we ofwel de gevonden code, ofwel "??????" als die laag nog niet is opgelost (`val` is dan een lege string, dus "falsy").

## Hint-systeem

### HINTS

```js
const HINTS = [
  "Let op de eerste letter van elke zin in de tekst hierboven.",
  "Elke fragmenttekst beschrijft het wapendier van één huis. Welk dier hoort bij welk huis?",
  "Elk symbool staat steeds voor dezelfde letter. Bouw het woord op, symbool voor symbool, met de legenda.",
  "Kijk naar je Verzamelde Aanwijzingen rechts in beeld en volg de formule exact, teken voor teken.",
];
```

Eén hinttekst per laag (index 0 = laag 1, enz.). `state.layer` bepaalt dus rechtstreeks welke hint er getoond wordt.

### handleClickHint

```js
const handleClickHint = () => {
  if (state.hintsLeft <= 0) return;
  state.hintsLeft = state.hintsLeft - 1;
  document.querySelector("#hints-left").textContent = state.hintsLeft;
  applyPenalty(HINT_PENALTY);
  const $hintBtn = document.querySelector("#btn-hint");
  playShake($hintBtn);
  const $panel = document.querySelector("#hint-panel");
  if ($panel) {
    $panel.textContent = `💡 ${HINTS[state.layer]}`;
    $panel.classList.add("show");
  }
  if (state.hintsLeft === 0) $hintBtn.disabled = true;
};
```

Verwerkt een klik op de hintknop. Stopt meteen als er geen hints meer over zijn. Anders: één hint minder, teller bijwerken, tijdstraf toepassen, knop laten schudden als feedback, en de hinttekst tonen. Bij de laatste hint wordt de knop uitgeschakeld zodat de speler niet nog meer hints (en tijdstraffen) kan opvragen.

## Naar volgende laag

### goToLayer

```js
const goToLayer = (n) => {
  state.layer = n;
  renderProgress();
  renderClues();
  const panelHtml = `<div class="hint-panel" id="hint-panel"></div>`;
  if (n === 0) {
    renderLayer1(panelHtml);
  } else if (n === 1) {
    renderLayer2(panelHtml);
  } else if (n === 2) {
    renderLayer3(panelHtml);
  } else if (n === 3) {
    renderLayer4(panelHtml);
  }
};
```

Wisselt naar laag `n`: werkt voortgang/zijbalk bij en tekent de juiste laag. Elke laag heeft zijn eigen render-functie (`renderLayer1` t/m `renderLayer4`) die de volledige HTML van `#layer-content` opnieuw opbouwt. `panelHtml` is een leeg hint-paneel dat aan elke laag wordt meegegeven, zodat elke laag een plek heeft om de opgevraagde hint in te tonen.

### solveLayer

```js
const solveLayer = (fragmentValue, feedbackMsg) => {
  state.fragments[state.layer] = fragmentValue;
  flashSuccess();
  const $feedback = document.querySelector("#layer-feedback");
  if ($feedback) {
    $feedback.textContent = feedbackMsg || "Correct. De volgende laag ontgrendelt...";
    $feedback.classList.remove("bad");
    $feedback.classList.add("ok");
  }
  setTimeout(() => {
    if (state.layer < 3) {
      goToLayer(state.layer + 1);
    } else {
      winGame();
    }
  }, 1300);
};
```

Wordt aangeroepen zodra een laag correct is opgelost. `fragmentValue` is de code die deze laag oplevert (bv. `"ARX"`); die wordt bewaard in `state.fragments` zodat laag 4 er later de Meestercode mee kan samenstellen. Na een korte vertraging (1300ms, zodat de speler de succesboodschap en -animatie kan zien) gaat het spel automatisch door naar de volgende laag, of naar `winGame()` als dit de laatste laag was.

### showBadFeedback

```js
const showBadFeedback = (msg) => {
  const $feedback = document.querySelector("#layer-feedback");
  if ($feedback) {
    $feedback.textContent = msg;
    $feedback.classList.remove("ok");
    $feedback.classList.add("bad");
  }
};
```

Toont foutfeedback onder de huidige laag. Wordt door elke laag opgeroepen bij een fout antwoord; wisselt simpelweg de klasse `ok` om naar `bad` zodat de CSS de tekst rood/anders kan kleuren.

## Laag 1: Coderadepuzzel

Drie letterwielen die de speler naar de code "ARX" moet zetten. De code staat verstopt als acrostichon: de eerste letter van elke zin in de flavourtekst (Aan.../Radeloos.../X markeert...) spelt A-R-X.

```js
const wheelState = [0, 0, 0];
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const TARGET_1 = "ARX";
```

- `wheelState`: huidige letterindex (0-25) per wiel, 0 = 'A'.
- `ALPHA`: alle 26 letters, gebruikt om van index naar letter (en terug) te gaan.
- `TARGET_1`: de correcte code voor laag 1.

### handleClickWheelButton

```js
const handleClickWheelButton = ($btn) => {
  const idx = parseInt($btn.dataset.idx, 10);
  const dir = parseInt($btn.dataset.dir, 10);
  wheelState[idx] = wheelState[idx] + dir;
  if (wheelState[idx] < 0) wheelState[idx] = ALPHA.length - 1;
  if (wheelState[idx] >= ALPHA.length) wheelState[idx] = 0;
  document.querySelector(`#dial-current-${idx}`).textContent = ALPHA[wheelState[idx]];
};
```

Verwerkt een klik op een ◀/▶ knop van een letterwiel. `data-idx` op de knop zegt welk wiel (0, 1 of 2) het is; `data-dir` zegt de richting (-1 voor ◀, +1 voor ▶). We tellen `dir` op bij de huidige index en laten die "rondlopen": onder 0 spring je naar de laatste letter (Z), voorbij de laatste letter spring je terug naar de eerste (A).

### handleClickCheckWheels

```js
const handleClickCheckWheels = () => {
  const guess = `${ALPHA[wheelState[0]]}${ALPHA[wheelState[1]]}${ALPHA[wheelState[2]]}`;
  if (guess === TARGET_1) {
    solveLayer(TARGET_1, "De cijferwielen klikken vast. ARX, de Latijnse burcht. Toegang verleend.");
  } else {
    showBadFeedback("De wielen weigeren te bewegen. Dit is niet de juiste code.");
    document.querySelectorAll(".dial-box").forEach(($box) => playShake($box));
  }
};
```

Verwerkt een klik op de "Ontgrendel"-knop van laag 1. Bouwt uit de drie huidige wielstanden de geraden code op en vergelijkt die met `TARGET_1`. Bij een fout schudden alle drie de wielen als feedback.

### renderLayer1

```js
const renderLayer1 = (panelHtml) => {
  wheelState[0] = 0;
  wheelState[1] = 0;
  wheelState[2] = 0;
  const $layerContent = document.querySelector("#layer-content");
  $layerContent.innerHTML = `
    <div class="layer-inner">
      <div class="layer-eyebrow">Laag I van IV</div>
      <h2 class="layer-title">Het Coderadeslot</h2>
      <div class="layer-flavor">
        <span class="acro-letter">A</span>an de rand van het weten wacht een zware deur.<br>
        <span class="acro-letter">R</span>adeloos zoekt de leerling-archivaris naar een teken in het steen.<br>
        <span class="acro-letter">X</span> markeert nooit toeval. Lees de eerste letters van dit vers, van boven naar beneden.
      </div>
      <div class="wheels" id="wheels"></div>
      <div style="text-align:center;">
        <button class="btn btn-primary" id="btn-check1" type="button">Ontgrendel</button>
      </div>
      <div class="feedback-msg" id="layer-feedback"></div>
      ${panelHtml}
    </div>
  `;

  const $wheelsWrap = document.querySelector("#wheels");
  $wheelsWrap.innerHTML = [0, 1, 2]
    .map(
      (idx) => `
      <div class="wheel">
        <div class="dial-box"><span class="dial-current" id="dial-current-${idx}">${ALPHA[wheelState[idx]]}</span></div>
        <div class="wheel-btns">
          <button data-idx="${idx}" data-dir="-1" type="button">◀</button>
          <button data-idx="${idx}" data-dir="1" type="button">▶</button>
        </div>
      </div>
    `
    )
    .join("");

  document.querySelectorAll(".wheel-btns button").forEach(($btn) => {
    $btn.addEventListener("click", () => handleClickWheelButton($btn));
  });

  document.querySelector("#btn-check1").addEventListener("click", handleClickCheckWheels);
};
```

Bouwt de HTML voor laag 1 op en koppelt de bijhorende event listeners. De wielen worden bij elke render teruggezet op 'A' (`wheelState = 0`), zodat de puzzel altijd vers begint als je deze laag (opnieuw) bereikt.

De drie wielen worden dynamisch gegenereerd (in plaats van drie keer dezelfde HTML te kopiëren) zodat we makkelijk het aantal wielen zouden kunnen aanpassen. `.map()` bouwt voor elke index (0,1,2) een blokje HTML, `.join("")` plakt die blokjes samen tot één string.

Elke ◀/▶ knop draait zijn eigen wiel één letter verder.

## Laag 2: Waszegelarchief

Vier fragmenten (elk met een dier-symbool en een korte omschrijving) moeten gekoppeld worden aan het bijbehorende adellijke huis.

```js
const HOUSES = [
  { name: "Huis Leeuwenhart", digit: "7", symbol: "🦁" },
  { name: "Huis Adelaarsnest", digit: "3", symbol: "🦅" },
  { name: "Huis Steenburcht", digit: "9", symbol: "🏰" },
  { name: "Huis Uilenwoud", digit: "1", symbol: "🦉" },
];
const FRAGMENTS = [
  { id: 0, symbol: "🦁", text: "De leeuw heerst hier, moedig en vrij.", houseIdx: 0 },
  { id: 1, symbol: "🦅", text: "De adelaar ziet alles, hoog boven de mensen.", houseIdx: 1 },
  { id: 2, symbol: "🏰", text: "De muren van dit huis zijn nooit gevallen.", houseIdx: 2 },
  { id: 3, symbol: "🦉", text: "Tussen de takken sluimert het woud.", houseIdx: 3 },
];
let sealAssignments = {};
let selectedFrag = null;
```

`houseIdx` verwijst naar de index in `HOUSES`: zo weten we welk fragment bij welk huis hoort zonder de tekst zelf te moeten "begrijpen".

- `sealAssignments`: `{ fragmentId: houseIdx }` voor elk correct gekoppeld fragment.
- `selectedFrag`: id van het fragment dat de speler nu geselecteerd heeft (`null` = niets geselecteerd).

### handleClickFragment

```js
const handleClickFragment = (fragId, $card) => {
  if ($card.classList.contains("solved")) return;
  document.querySelectorAll(".frag-card").forEach(($c) => $c.classList.remove("selected"));
  $card.classList.add("selected");
  selectedFrag = fragId;
};
```

Selecteert een fragmentkaart zodat de speler daarna een huis kan aanklikken. Een fragment dat al opgelost is ("solved") kan niet opnieuw geselecteerd worden. Alle andere kaarten verliezen hun "selected"-status, zodat er nooit meer dan één fragment tegelijk geselecteerd is.

### handleClickHouse

```js
const handleClickHouse = (houseIdx, $houseBtn) => {
  if (selectedFrag === null || $houseBtn.classList.contains("solved")) return;
  const frag = FRAGMENTS.find((f) => f.id === selectedFrag);
  const $fragCard = document.querySelector(`#frag-${selectedFrag}`);
  if (frag.houseIdx === houseIdx) {
    $fragCard.classList.remove("selected");
    $fragCard.classList.add("solved");
    $houseBtn.classList.add("solved");
    document.querySelector(`#house-shield-${houseIdx}`).textContent = HOUSES[houseIdx].symbol;
    sealAssignments[selectedFrag] = houseIdx;
    selectedFrag = null;
    const solvedCount = Object.keys(sealAssignments).length;
    if (solvedCount === 4) {
      const code = HOUSES.map((h) => h.digit).join("");
      solveLayer(code, `Alle zegels rusten op hun plek. Het slot fluistert een getal: ${code}.`);
    }
  } else {
    $fragCard.classList.add("shake");
    $houseBtn.classList.add("shake");
    setTimeout(() => {
      $fragCard.classList.remove("shake", "selected");
      $houseBtn.classList.remove("shake");
    }, 500);
    selectedFrag = null;
  }
};
```

Verwerkt een klik op een huis: bij juiste koppeling worden fragment en huis als "solved" gemarkeerd. Zijn alle vier gekoppeld, dan is de laag opgelost. Het wapendier-symbool wordt op het huis-schild getoond als visuele bevestiging. De code voor deze laag is simpelweg elk huis-cijfer op volgorde van `HOUSES`. Bij een foute koppeling schudden zowel de fragmentkaart als de huisknop, en wordt de selectie na 500ms teruggezet zodat de speler opnieuw kan kiezen.

### renderLayer2

```js
const renderLayer2 = (panelHtml) => {
  sealAssignments = {};
  selectedFrag = null;
  const shuffledFrags = shuffle(FRAGMENTS);
  const $layerContent = document.querySelector("#layer-content");
  $layerContent.innerHTML = `
    <div class="layer-inner">
      <div class="layer-eyebrow">Laag II van IV</div>
      <h2 class="layer-title">Het Waszegelarchief</h2>
      <div class="layer-flavor">
        Vier verzegelde fragmenten liggen los van hun herkomst. Kies een zegel, en klik
        daarna het adellijke huis waarbij het volgens jou hoort.
      </div>
      <div class="seals-grid">
        <div class="seal-col" id="frag-list"></div>
        <div class="house-list" id="house-list"></div>
      </div>
      <div class="feedback-msg" id="layer-feedback"></div>
      ${panelHtml}
    </div>
  `;

  const $fragList = document.querySelector("#frag-list");
  $fragList.innerHTML = shuffledFrags
    .map(
      (f) => `
      <button type="button" class="frag-card seal-item" id="frag-${f.id}">
        <div class="seal-circle">${f.symbol}</div><div class="seal-caption">${f.text}</div>
      </button>
    `
    )
    .join("");
  shuffledFrags.forEach((f) => {
    const $card = document.querySelector(`#frag-${f.id}`);
    $card.addEventListener("click", () => handleClickFragment(f.id, $card));
  });

  const $houseList = document.querySelector("#house-list");
  $houseList.innerHTML = HOUSES.map(
    (h, idx) => `
      <button type="button" class="house-btn" id="house-${idx}">
        <span class="house-shield" id="house-shield-${idx}"></span><span class="house-info"><span>${h.name}</span></span>
      </button>
    `
  ).join("");
  HOUSES.forEach((_, idx) => {
    const $houseBtn = document.querySelector(`#house-${idx}`);
    $houseBtn.addEventListener("click", () => handleClickHouse(idx, $houseBtn));
  });
};
```

Bouwt de HTML voor laag 2 op: een kolom met gehusselde fragmentkaarten links en de vier huizen rechts, en koppelt de klik-handlers.

## Laag 3: Manuscriptvertaling

Een simpel substitutie-geheimschrift: elk symbool staat voor één vaste letter.

```js
const CIPHER = [
  { sym: "◆", letter: "V" },
  { sym: "●", letter: "E" },
  { sym: "▲", letter: "R" },
  { sym: "■", letter: "I" },
  { sym: "✦", letter: "T" },
  { sym: "✚", letter: "A" },
  { sym: "◈", letter: "S" },
];
const TARGET_4 = "VERITAS";
```

`TARGET_4` is het woord dat de speler moet ontcijferen.

### handleSubmitTranslation

```js
const handleSubmitTranslation = (event) => {
  event.preventDefault();
  const $form = event.currentTarget;
  const formData = new FormData($form);
  const formValues = Object.fromEntries(formData);
  const val = (formValues.answer || "").trim().toUpperCase();
  if (val === TARGET_4) {
    solveLayer(TARGET_4, `Het manuscript ontvouwt zich vanzelf. "${TARGET_4}", waarheid.`);
  } else {
    showBadFeedback("Dat woord opent niets. Controleer de legenda nogmaals.");
    playShake(document.querySelector("#input3"));
  }
  $form.reset();
};
```

Verwerkt het indienen van het vertaal-formulier van laag 3. `event.preventDefault()` voorkomt dat de pagina herlaadt (het standaardgedrag van een `<form>` submit). `FormData` + `Object.fromEntries` halen de waarde van het invoerveld op via zijn "name"-attribuut (`"answer"`). Het antwoord wordt getrimd en in hoofdletters gezet zodat spaties en hoofdletter/kleine letter-verschillen niet fataal zijn.

### renderLayer3

```js
const renderLayer3 = (panelHtml) => {
  const legend = shuffle(CIPHER);
  const encoded = TARGET_4.split("")
    .map((letter) => CIPHER.find((c) => c.letter === letter).sym)
    .join(" ");

  const $layerContent = document.querySelector("#layer-content");
  $layerContent.innerHTML = `
    <div class="layer-inner">
      <div class="layer-eyebrow">Laag III van IV</div>
      <h2 class="layer-title">De Manuscriptvertaling</h2>
      <div class="layer-flavor">
        Een laatste manuscript ligt open op de lezenaar, geschreven in het geheimschrift van
        de aartsarchivarissen. Gebruik de legenda om het verborgen woord te ontcijferen.
      </div>
      <div class="manuscript-sheet parchment-texture">
        <div class="legend-grid" id="legend"></div>
        <div class="encoded-word">${encoded}</div>
      </div>
      <form class="answer-form" id="form3">
        <label for="input3" class="visually-hidden">Jouw vertaling</label>
        <input type="text" id="input3" name="answer" placeholder="Typ hier je vertaling..." autocomplete="off" required>
        <button class="btn btn-primary" type="submit">Controleer</button>
      </form>
      <div class="feedback-msg" id="layer-feedback"></div>
      ${panelHtml}
    </div>
  `;

  const $legend = document.querySelector("#legend");
  $legend.innerHTML = legend.map((c) => `<div class="legend-cell"><span class="sym">${c.sym}</span>= ${c.letter}</div>`).join("");

  const $form3 = document.querySelector("#form3");
  $form3.addEventListener("submit", handleSubmitTranslation);
};
```

Bouwt de HTML voor laag 3 op. De legenda (welk symbool bij welke letter hoort) wordt gehusseld getoond zodat de speler niet zomaar de volgorde van het geheimschrift kan afkijken. `encoded` zet elke letter van `TARGET_4` om naar zijn symbool, zodat op het scherm enkel de gecodeerde tekst te zien is.

## Laag 4: De Finale Reeks

```js
const MANDALA_SVG = `
  <svg viewBox="0 0 300 300" class="mandala-bg">
    <circle cx="150" cy="150" r="140" fill="none" stroke="var(--gold)" stroke-width="1"/>
    <circle cx="150" cy="150" r="110" fill="none" stroke="var(--gold)" stroke-width="1"/>
    <circle cx="150" cy="150" r="80" fill="none" stroke="var(--gold)" stroke-width="1"/>
    <line x1="150" y1="10" x2="150" y2="290" stroke="var(--gold)" stroke-width="1"/>
    <line x1="10" y1="150" x2="290" y2="150" stroke="var(--gold)" stroke-width="1"/>
    <line x1="52" y1="52" x2="248" y2="248" stroke="var(--gold)" stroke-width="1"/>
    <line x1="248" y1="52" x2="52" y2="248" stroke="var(--gold)" stroke-width="1"/>
    <circle cx="150" cy="150" r="34" fill="none" stroke="var(--gold)" stroke-width="1.5"/>
    <path d="M150 130 v28 M138 158 h24" stroke="var(--gold)" stroke-width="3" stroke-linecap="round"/>
  </svg>
`;
```

Decoratieve achtergrond achter de fragment-overzichtsvakjes van laag 4. Dit is pure SVG (vector-tekening): cirkels, lijnen en een klein "sleutelgat"-icoontje, enkel voor de sfeer, geen interactieve functie.

### renderFragmentRows

```js
const renderFragmentRows = () => {
  const labels = [
    { label: "Laag I: Coderadepuzzel", len: 3 },
    { label: "Laag II: Waszegelarchief", len: 4 },
    { label: "Laag III: Manuscriptvertaling", len: 7 },
  ];
  return labels
    .map((l, i) => {
      const val = state.fragments[i];
      const chars = val ? val.split("") : Array(l.len).fill("?");
      const boxes = chars.map((c) => `<span class="fbox${val ? " filled" : ""}">${c}</span>`).join("");
      return `<div class="fragment-row"><div class="frow-label">${l.label}</div><div class="frow-boxes">${boxes}</div></div>`;
    })
    .join("");
};
```

Tekent de vier rijen met vakjes die tonen welke fragment-codes al gevonden zijn. Voor elke laag: als de code al bekend is (`state.fragments[i]` is niet leeg), tonen we die letters/cijfers; anders tonen we evenveel "?"-vakjes als de code lang zou zijn (`l.len`), zodat de speler ziet hoeveel tekens er nog missen.

### handleSubmitMasterCode

```js
const handleSubmitMasterCode = (event, finalCode) => {
  event.preventDefault();
  const $form = event.currentTarget;
  const formData = new FormData($form);
  const formValues = Object.fromEntries(formData);
  const val = (formValues.answer || "").trim().toUpperCase().replace(/[\s-]/g, "");
  if (val === finalCode.toUpperCase()) {
    solveLayer(finalCode, "De kluisdeur ontgrendelt met een diepe, mechanische zucht...");
  } else {
    showBadFeedback("Het slot weigert. Controleer de formule en je verzamelde aanwijzingen.");
    playShake(document.querySelector("#input4"));
  }
  $form.reset();
};
```

Verwerkt het indienen van het Meestercode-formulier van laag 4. `finalCode` wordt door `renderLayer4` berekend en hier meegegeven, zodat deze functie niet zelf opnieuw hoeft te weten hoe de code is opgebouwd. Spaties/streepjes worden genegeerd zodat opmaakverschillen niet fataal zijn (regex `/[\s-]/g`: elk stukje "whitespace" of een "-", overal in de tekst).

### renderLayer4

```js
const renderLayer4 = (panelHtml) => {
  const f0 = state.fragments[0];
  const f1 = state.fragments[1];
  const f2 = state.fragments[2];
  const finalCode = f0.slice(-1) + f1 + f2.slice(0, 3);

  const $layerContent = document.querySelector("#layer-content");
  $layerContent.innerHTML = `
    <div class="layer-inner">
      <div class="layer-eyebrow">Laag IV van IV: Laatste Slot</div>
      <h2 class="layer-title">De Finale Reeks</h2>
      <div class="layer-flavor">
        Een laatste inscriptie gloeit op: <em>"Voer de Meestercode in, samengesteld uit alles wat je vond."</em>
      </div>
      <div class="mandala-wrap">
        ${MANDALA_SVG}
        <div class="fragment-rows">${renderFragmentRows()}</div>
      </div>
      <div class="formula-box">
        Meestercode = <b>laatste letter</b> van Laag I&nbsp;+&nbsp;<b>volledige code</b> van Laag II&nbsp;+&nbsp;<b>eerste 3 letters</b> van Laag III
      </div>
      <form class="answer-form" id="form4">
        <label for="input4" class="visually-hidden">Meestercode</label>
        <input type="text" id="input4" name="answer" placeholder="Voer de Meestercode in..." autocomplete="off" required>
        <button class="btn btn-primary" type="submit">Open de Kluis</button>
      </form>
      <div class="feedback-msg" id="layer-feedback"></div>
      ${panelHtml}
    </div>
  `;

  const $form4 = document.querySelector("#form4");
  $form4.addEventListener("submit", (event) => handleSubmitMasterCode(event, finalCode));
};
```

Bouwt laag 4 op: berekent de correcte Meestercode uit de drie fragmenten (laatste letter van I + volledige code van II + eerste 3 letters van III) en toont de formule expliciet. `.slice(-1)` pakt het laatste teken van een string, `.slice(0, 3)` pakt de eerste drie tekens. Deze berekening kan alleen kloppen als alle drie de vorige lagen al zijn opgelost (wat op dit punt altijd het geval is, want je bereikt laag 4 pas na laag 1 t/m 3).

## Winnen / verliezen

### winGame

```js
const winGame = () => {
  stopTimer();
  showScreen("screen-win");
  document.querySelector("#final-time").textContent = formatTime(state.elapsed);
  const $door = document.querySelector(".vault-door");
  $door.classList.remove("open");
  setTimeout(() => $door.classList.add("open"), 50);
};
```

Stopt de timer, toont het winscherm en zet de eindtijd neer. De kluisdeur-animatie wordt met dezelfde "class weghalen, dan terugzetten na een timeout"-truc opnieuw getriggerd als de speler wint (zie ook `flashSuccess`/`playShake` hierboven voor dezelfde techniek).

### loseGame

```js
const loseGame = () => {
  showScreen("screen-lose");
};
```

Toont het verliesscherm wanneer de timer op nul komt.

## Leaderboard

### getLeaderboard

```js
const getLeaderboard = () => {
  try {
    const raw = localStorage.getItem(LB_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
};
```

Leest het opgeslagen leaderboard uit localStorage. localStorage bewaart enkel strings, dus de lijst met scores wordt als JSON-tekst opgeslagen en hier terug omgezet (geparsed) naar een array. De try/catch vangt op als er (bv. door een oude/foute waarde) geen geldige JSON in localStorage zou staan; dan geven we gewoon een lege lijst terug in plaats van dat de pagina crasht.

### saveScore

```js
const saveScore = (name) => {
  const scores = getLeaderboard();
  scores.push({ name: name.slice(0, 18) || "Anoniem", time: state.elapsed, date: new Date().toISOString() });
  scores.sort((a, b) => a.time - b.time);
  localStorage.setItem(LB_KEY, JSON.stringify(scores.slice(0, 10)));
};
```

Voegt een nieuwe score toe, sorteert op tijd en bewaart enkel de beste 10. De naam wordt afgekapt op 18 tekens (om de lijst netjes te houden) en vervangen door "Anoniem" als er niets werd ingevuld. Na het sorteren (snelste tijd eerst) bewaren we met `.slice(0, 10)` enkel de top 10, zodat het leaderboard niet oneindig blijft groeien.

### renderLeaderboard

```js
const renderLeaderboard = () => {
  const scores = getLeaderboard();
  const $content = document.querySelector("#lb-content");
  if (scores.length === 0) {
    $content.innerHTML = `
      <div class="lb-empty">Nog niemand is ontsnapt aan de Verboden Kluis...</div>
      <div class="lb-empty-hint">Speel eerst het spel uit om hier te verschijnen.</div>
    `;
    return;
  }
  const items = scores
    .map((s, i) => `<li><span class="lb-rank">${i + 1}.</span><span class="lb-name">${escapeHtml(s.name)}</span><span class="lb-time">${formatTime(s.time)}</span></li>`)
    .join("");
  $content.innerHTML = `<ul class="lb-list">${items}</ul>`;
};
```

Tekent het leaderboard-scherm. Is de lijst leeg, dan tonen we een uitleg-tekst i.p.v. een lege lijst. Anders bouwen we voor elke score een `<li>` met rangnummer, naam en tijd.

### handleClickShowLeaderboard

```js
const handleClickShowLeaderboard = () => {
  renderLeaderboard();
  showScreen("screen-leaderboard");
};
```

Verwerkt een klik op een van de "bekijk archief"-knoppen.

### handleSubmitScore

```js
const handleSubmitScore = (event) => {
  event.preventDefault();
  const $form = event.currentTarget;
  const formData = new FormData($form);
  const formValues = Object.fromEntries(formData);
  const name = (formValues.playerName || "").trim() || "Anoniem";
  saveScore(name);
  $form.innerHTML = `<span style="color:#7FBF7F;">Tijd bewaard in het archief.</span>`;
};
```

Verwerkt het indienen van het naam-formulier op het winscherm. Slaat de score op onder de ingevulde naam (of "Anoniem" als leeg) en vervangt daarna de inhoud van het formulier door een bevestigingstekstje, zodat de speler niet twee keer dezelfde score kan opslaan.

## Reset / start

### resetState

```js
const resetState = () => {
  stopTimer();
  state.layer = 0;
  state.timeLeft = TOTAL_TIME;
  state.hintsLeft = 3;
  state.fragments = ["", "", ""];
  state.elapsed = 0;
  document.querySelector("#hints-left").textContent = 3;
  document.querySelector("#btn-hint").disabled = false;
};
```

Zet alle spelstatus terug naar de beginwaarden, klaar voor een nieuwe poging. Let op: dit reset niet de timer-styling of de knopjes die per laag worden aangemaakt — dat gebeurt vanzelf omdat `goToLayer(0)` (in `beginGame`) de hele laag-HTML opnieuw opbouwt.

### beginGame

```js
const beginGame = () => {
  resetState();
  updateTimerDisplay();
  showScreen("screen-game");
  goToLayer(0);
  startTimer();
};
```

Start een nieuwe poging: reset alles, toon het spelscherm en start de klok.

## Init

```js
const init = () => {
  document.querySelector("#btn-start").addEventListener("click", beginGame);
  document.querySelector("#btn-show-leaderboard").addEventListener("click", handleClickShowLeaderboard);
  document.querySelector("#btn-lb-back").addEventListener("click", () => showScreen("screen-intro"));
  document.querySelector("#btn-hint").addEventListener("click", handleClickHint);
  document.querySelector("#score-form").addEventListener("submit", handleSubmitScore);
  document.querySelector("#btn-win-leaderboard").addEventListener("click", handleClickShowLeaderboard);
  document.querySelector("#btn-win-again").addEventListener("click", () => showScreen("screen-intro"));
  document.querySelector("#btn-lose-again").addEventListener("click", beginGame);
  document.querySelector("#btn-lose-leaderboard").addEventListener("click", handleClickShowLeaderboard);

  updateTimerDisplay();
};

init();
```

Koppelt alle statische knoppen aan hun handler en toont de starttijd. "Statisch" betekent hier: knoppen die altijd in de HTML staan (niet dynamisch per laag aangemaakt), dus ze hoeven maar één keer bij het opstarten van event listeners voorzien te worden. Meteen wordt "03:00" getoond bij het laden van de pagina.

Tot slot wordt `init()` opgeroepen om alles te starten zodra dit script wordt geladen. Het `<script>`-tag staat in `index.html` helemaal onderaan de `<body>`, dus de DOM-elementen bestaan op dit moment al.
