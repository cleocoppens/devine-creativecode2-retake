// ---------- instellingen ----------
const TOTAL_TIME = 300; // countdown duur in seconden (5 minuten)
const HINT_PENALTY = 60; // seconden die een hint van de resterende tijd afhaalt
const LB_KEY = "verbodenKluisLeaderboard"; // localStorage-sleutel voor het leaderboard

// ---------- spelstatus ----------
// Eén groot object dat bijhoudt hoever de speler staat.
const state = {
  layer: 0, // welke laag we nu spelen (0 t/m 4)
  timeLeft: TOTAL_TIME, // resterende seconden op de klok
  timerId: null, // referentie naar setInterval, nodig om te kunnen stoppen
  hintsLeft: 3, // aantal hints dat nog gebruikt mag worden
  running: false, // of de timer nu loopt
  fragments: ["", "", "", ""], // opgeloste codes per laag (I t/m IV)
  startTimestamp: null,
  elapsed: 0, // verstreken seconden, wordt de eindtijd bij winst
};

// Wisselt van scherm door de "active" class te verplaatsen.
const showScreen = (id) => {
  const $screens = document.querySelectorAll(".screen");
  $screens.forEach(($screen) => $screen.classList.remove("active"));
  const $target = document.querySelector("#" + id);
  $target.classList.add("active");
};

// Husselt een array in willekeurige volgorde.
const shuffle = (arr) => {
  const copy = arr.slice();
  copy.sort(() => Math.random() - 0.5);
  return copy;
};

// Zet een getal om naar 2 cijfers, bv. 5 -> "05".
const pad = (n) => {
  if (n < 10) return "0" + n;
  return "" + n;
};

// Zet seconden om naar MM:SS voor de timer en het leaderboard.
const formatTime = (secs) => {
  const s = secs < 0 ? 0 : secs;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return pad(m) + ":" + pad(r);
};

// Laat de gouden flits even opnieuw afspelen bij een correcte oplossing.
const flashSuccess = () => {
  const $flash = document.querySelector("#success-flash");
  $flash.classList.remove("play");
  setTimeout(() => $flash.classList.add("play"), 10);
};

// Laat een element kort schudden (foutfeedback).
const playShake = ($el) => {
  $el.classList.remove("shake");
  setTimeout(() => $el.classList.add("shake"), 10);
  setTimeout(() => $el.classList.remove("shake"), 500);
};

// ---------- timer ----------
// Ververst de klok in de header en zet de rode "warning"-stijl aan
// zodra er nog maar 60 seconden of minder over zijn.
const updateTimerDisplay = () => {
  const $timerDisplay = document.querySelector("#timer-display");
  $timerDisplay.innerHTML = '<span class="timer-label">Tijd tot zuivering</span>' + formatTime(state.timeLeft);
  $timerDisplay.classList.toggle("warning", state.timeLeft <= 60);
};

// Start de countdown: elke seconde gaat timeLeft omlaag.
const startTimer = () => {
  state.running = true;
  state.startTimestamp = Date.now();
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

// Zet de lopende timer stil.
const stopTimer = () => {
  state.running = false;
  if (state.timerId) {
    clearInterval(state.timerId);
  }
  state.timerId = null;
};

// Trekt de tijdstraf van een hint af van de klok.
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

// ---------- voortgang + aanwijzingen ----------
const LAYER_NAMES = ["Coderadepuzzel", "Boekclassificatie", "Waszegelarchief", "Manuscriptvertaling", "De Finale Reeks"];

// Bouwt de rij voortgangsstippen in de header.
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

// Toont de tot nu toe verzamelde fragment-codes in de zijbalk.
const renderClues = () => {
  const $list = document.querySelector("#clues-list");
  $list.innerHTML = "";
  const labels = ["Laag I", "Laag II", "Laag III", "Laag IV"];
  labels.forEach((label, i) => {
    const $item = document.createElement("div");
    $item.className = "clue-item";
    const val = state.fragments[i];
    const valueClass = val ? "clue-value" : "clue-value unknown";
    $item.innerHTML = '<span class="clue-label">' + label + '</span><span class="' + valueClass + '">' + (val || "??????") + "</span>";
    $list.appendChild($item);
  });
};

// ---------- hint-systeem ----------
const HINTS = [
  "Let op de eerste letter van elke zin in de tekst hierboven.",
  "De boeken staan niet op alfabet, maar op ouderdom — kijk naar het jaartal op elke rug.",
  "Elke fragmenttekst beschrijft het wapendier van één huis. Welk dier hoort bij welk huis?",
  "Elk symbool staat steeds voor dezelfde letter. Bouw het woord op, symbool voor symbool, met de legenda.",
  "Kijk naar je Verzamelde Aanwijzingen rechts in beeld en volg de formule exact, teken voor teken.",
];

// Verwerkt een klik op de hintknop.
const handleClickHint = () => {
  if (state.hintsLeft <= 0) return;
  state.hintsLeft = state.hintsLeft - 1;
  document.querySelector("#hints-left").textContent = state.hintsLeft;
  applyPenalty(HINT_PENALTY);
  const $hintBtn = document.querySelector("#btn-hint");
  playShake($hintBtn);
  const $panel = document.querySelector("#hint-panel");
  if ($panel) {
    $panel.textContent = "💡 " + HINTS[state.layer];
    $panel.classList.add("show");
  }
  if (state.hintsLeft === 0) $hintBtn.disabled = true;
};

// ---------- naar volgende laag ----------
// Wisselt naar laag n: werkt voortgang/zijbalk bij en tekent de juiste laag.
const goToLayer = (n) => {
  state.layer = n;
  renderProgress();
  renderClues();
  const panelHtml = '<div class="hint-panel" id="hint-panel"></div>';
  if (n === 0) {
    renderLayer1(panelHtml);
  } else if (n === 1) {
    renderLayer2(panelHtml);
  } else if (n === 2) {
    renderLayer3(panelHtml);
  } else if (n === 3) {
    renderLayer4(panelHtml);
  } else if (n === 4) {
    renderLayer5(panelHtml);
  }
};

// Wordt aangeroepen zodra een laag correct is opgelost.
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
    if (state.layer < 4) {
      goToLayer(state.layer + 1);
    } else {
      winGame();
    }
  }, 1300);
};

// Toont foutfeedback onder de huidige laag.
const showBadFeedback = (msg) => {
  const $feedback = document.querySelector("#layer-feedback");
  if ($feedback) {
    $feedback.textContent = msg;
    $feedback.classList.remove("ok");
    $feedback.classList.add("bad");
  }
};

// ================= LAAG 1: Coderadepuzzel =================
// Drie letterwielen die de speler naar de code "ARX" moet zetten.
// De code staat verstopt als acrostichon: de eerste letter van elke zin
// in de flavourtekst (Aan.../Radeloos.../X markeert...) spelt A-R-X.
const wheelState = [0, 0, 0]; // huidige letterindex (0-25) per wiel
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const TARGET_1 = "ARX";

// Verwerkt een klik op een ◀/▶ knop van een letterwiel.
const handleClickWheelButton = ($btn) => {
  const idx = parseInt($btn.dataset.idx, 10);
  const dir = parseInt($btn.dataset.dir, 10);
  wheelState[idx] = wheelState[idx] + dir;
  if (wheelState[idx] < 0) wheelState[idx] = ALPHA.length - 1;
  if (wheelState[idx] >= ALPHA.length) wheelState[idx] = 0;
  document.querySelector("#dial-current-" + idx).textContent = ALPHA[wheelState[idx]];
};

// Verwerkt een klik op de "Ontgrendel"-knop van laag 1.
const handleClickCheckWheels = () => {
  const guess = ALPHA[wheelState[0]] + ALPHA[wheelState[1]] + ALPHA[wheelState[2]];
  if (guess === TARGET_1) {
    solveLayer(TARGET_1, "De cijferwielen klikken vast. ARX — de Latijnse burcht. Toegang verleend.");
  } else {
    showBadFeedback("De wielen weigeren te bewegen. Dit is niet de juiste code.");
    document.querySelectorAll(".dial-box").forEach(($box) => playShake($box));
  }
};

const renderLayer1 = (panelHtml) => {
  wheelState[0] = 0;
  wheelState[1] = 0;
  wheelState[2] = 0;
  const $layerContent = document.querySelector("#layer-content");
  $layerContent.innerHTML =
    '<div class="layer-inner">' +
    '<div class="layer-eyebrow">Laag I van V</div>' +
    '<h2 class="layer-title">Het Coderadeslot</h2>' +
    '<div class="layer-flavor">' +
    '<span class="acro-letter">A</span>an de rand van het weten wacht een zware deur.<br>' +
    '<span class="acro-letter">R</span>adeloos zoekt de leerling-archivaris naar een teken in het steen.<br>' +
    '<span class="acro-letter">X</span> markeert nooit toeval — lees de eerste letters van dit vers, van boven naar beneden.' +
    "</div>" +
    '<div class="wheels" id="wheels"></div>' +
    '<div style="text-align:center;">' +
    '<button class="btn btn-primary" id="btn-check1" type="button">Ontgrendel</button>' +
    "</div>" +
    '<div class="feedback-msg" id="layer-feedback"></div>' +
    panelHtml +
    "</div>";

  const $wheelsWrap = document.querySelector("#wheels");
  $wheelsWrap.innerHTML = "";
  [0, 1, 2].forEach((idx) => {
    const $wheel = document.createElement("div");
    $wheel.className = "wheel";
    $wheel.innerHTML =
      '<div class="dial-box"><span class="dial-current" id="dial-current-' +
      idx +
      '">' +
      ALPHA[wheelState[idx]] +
      "</span></div>" +
      '<div class="wheel-btns">' +
      '<button data-idx="' + idx + '" data-dir="-1" type="button">◀</button>' +
      '<button data-idx="' + idx + '" data-dir="1" type="button">▶</button>' +
      "</div>";
    $wheelsWrap.appendChild($wheel);
  });

  // Elke ◀/▶ knop draait zijn eigen wiel één letter verder.
  document.querySelectorAll(".wheel-btns button").forEach(($btn) => {
    $btn.addEventListener("click", () => handleClickWheelButton($btn));
  });

  document.querySelector("#btn-check1").addEventListener("click", handleClickCheckWheels);
};

// ================= LAAG 2: Boekclassificatie =================
// Zes boeken moeten in chronologische volgorde (jaartal) worden aangeklikt.
// De eerste letters van elk boek, gelezen van oud naar jong, spellen "GEHEIM".
const BOOKS = [
  { id: 0, title: "Chronicon Umbrae", year: 1350, letter: "G", color: "#7a2323", symbol: "☾" },
  { id: 1, title: "Liber Serpentis", year: 1402, letter: "E", color: "#1c2b45", symbol: "☿" },
  { id: 2, title: "Codex Nocturnus", year: 1487, letter: "H", color: "#3a3226", symbol: "♆" },
  { id: 3, title: "Fragmenta Arcana", year: 1523, letter: "E", color: "#2e4a3a", symbol: "⚚" },
  { id: 4, title: "Speculum Tenebris", year: 1601, letter: "I", color: "#26344a", symbol: "✶" },
  { id: 5, title: "Testamentum Umbrae", year: 1699, letter: "M", color: "#4a3a26", symbol: "♄" },
];
let bookSelection = []; // volgorde waarin de speler boeken heeft aangeklikt (array van id's)

// Tekent de zes plank-slots met pijltjes ertussen.
const renderShelf = () => {
  const $shelf = document.querySelector("#shelf");
  $shelf.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const $slot = document.createElement("div");
    $slot.className = bookSelection[i] !== undefined ? "slot filled" : "slot";
    $slot.id = "slot-" + i;
    $slot.textContent = bookSelection[i] !== undefined ? i + 1 : "";
    $shelf.appendChild($slot);
    if (i < 5) {
      const $arrow = document.createElement("span");
      $arrow.className = "slot-arrow";
      $arrow.textContent = "▶";
      $shelf.appendChild($arrow);
    }
  }
};

// Tekent de stapel klikbare boekkaarten. De volgorde wordt één keer gehusseld
// en bewaard in een data-attribuut, zodat een re-render niet opnieuw hust.
const renderBookPile = () => {
  const $pile = document.querySelector("#book-pile");
  $pile.innerHTML = "";
  const order = $pile.dataset.order ? JSON.parse($pile.dataset.order) : shuffle(BOOKS.map((b) => b.id));
  $pile.dataset.order = JSON.stringify(order);

  order.forEach((id) => {
    const book = BOOKS.find((b) => b.id === id);
    const $card = document.createElement("button");
    $card.type = "button";
    $card.className = bookSelection.indexOf(id) !== -1 ? "book-card used" : "book-card";
    $card.style.setProperty("--book-color", book.color);
    $card.innerHTML =
      '<span class="book-symbol">' + book.symbol + '</span><span class="book-title">' + book.title + '</span><span class="book-year">' + book.year + "</span>";
    $card.addEventListener("click", () => handleClickBook(id));
    $pile.appendChild($card);
  });
};

// Verwerkt een klik op een boek.
const handleClickBook = (id) => {
  if (bookSelection.indexOf(id) !== -1 || bookSelection.length >= 6) return;
  bookSelection.push(id);
  renderShelf();
  renderBookPile();
  if (bookSelection.length === 6) {
    const correctOrder = [0, 1, 2, 3, 4, 5]; // boeken staan al chronologisch gesorteerd op id
    const isCorrect = bookSelection.every((v, i) => v === correctOrder[i]);
    if (isCorrect) {
      const $slots = document.querySelectorAll(".slot");
      const code = correctOrder
        .map((bookId, i) => {
          const b = BOOKS.find((book) => book.id === bookId);
          $slots[i].textContent = b.letter;
          return b.letter;
        })
        .join("");
      solveLayer(code, "De boeken schuiven vast in hun sleuven. Samen vormen ze: " + code + ".");
    } else {
      showBadFeedback("Dit is niet de juiste volgorde van ouderdom. De plank reset zichzelf.");
      document.querySelectorAll(".slot").forEach(($slot) => $slot.classList.add("shake"));
      setTimeout(() => {
        bookSelection = [];
        renderShelf();
        renderBookPile();
      }, 650);
    }
  }
};

const renderLayer2 = (panelHtml) => {
  bookSelection = [];
  const $layerContent = document.querySelector("#layer-content");
  $layerContent.innerHTML =
    '<div class="layer-inner">' +
    '<div class="layer-eyebrow">Laag II van V</div>' +
    '<h2 class="layer-title">De Boekclassificatie</h2>' +
    '<div class="layer-flavor">' +
    "Zes verboden boeken staan door elkaar op de plank gegooid. De plank ontgrendelt " +
    "alleen als ze op ouderdom staan: van het oudste jaartal naar het jongste. Klik de " +
    "boeken in de juiste volgorde aan." +
    "</div>" +
    '<div class="shelf" id="shelf"></div>' +
    '<div class="book-pile" id="book-pile"></div>' +
    '<div class="feedback-msg" id="layer-feedback"></div>' +
    panelHtml +
    "</div>";
  renderShelf();
  renderBookPile();
};

// ================= LAAG 3: Waszegelarchief =================
// Vier fragmenten (elk met een dier-symbool en een korte omschrijving) moeten
// gekoppeld worden aan het bijbehorende adellijke huis.
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
let sealAssignments = {}; // { fragmentId: houseIdx } voor elk correct gekoppeld fragment
let selectedFrag = null; // id van het fragment dat de speler nu geselecteerd heeft

// Selecteert een fragmentkaart zodat de speler daarna een huis kan aanklikken.
const handleClickFragment = (fragId, $card) => {
  if ($card.classList.contains("solved")) return;
  document.querySelectorAll(".frag-card").forEach(($c) => $c.classList.remove("selected"));
  $card.classList.add("selected");
  selectedFrag = fragId;
};

// Verwerkt een klik op een huis: bij juiste koppeling worden fragment en huis
// als "solved" gemarkeerd. Zijn alle vier gekoppeld, dan is de laag opgelost.
const handleClickHouse = (houseIdx, $houseBtn) => {
  if (selectedFrag === null || $houseBtn.classList.contains("solved")) return;
  const frag = FRAGMENTS.find((f) => f.id === selectedFrag);
  const $fragCard = document.querySelector("#frag-" + selectedFrag);
  if (frag.houseIdx === houseIdx) {
    $fragCard.classList.remove("selected");
    $fragCard.classList.add("solved");
    $houseBtn.classList.add("solved");
    document.querySelector("#house-shield-" + houseIdx).textContent = HOUSES[houseIdx].symbol;
    sealAssignments[selectedFrag] = houseIdx;
    selectedFrag = null;
    const solvedCount = Object.keys(sealAssignments).length;
    if (solvedCount === 4) {
      const code = HOUSES.map((h) => h.digit).join("");
      solveLayer(code, "Alle zegels rusten op hun plek. Het slot fluistert een getal: " + code + ".");
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

const renderLayer3 = (panelHtml) => {
  sealAssignments = {};
  selectedFrag = null;
  const shuffledFrags = shuffle(FRAGMENTS);
  const $layerContent = document.querySelector("#layer-content");
  $layerContent.innerHTML =
    '<div class="layer-inner">' +
    '<div class="layer-eyebrow">Laag III van V</div>' +
    '<h2 class="layer-title">Het Waszegelarchief</h2>' +
    '<div class="layer-flavor">' +
    "Vier verzegelde fragmenten liggen los van hun herkomst. Kies een zegel, en klik " +
    "daarna het adellijke huis waarbij het volgens jou hoort." +
    "</div>" +
    '<div class="seals-grid">' +
    '<div class="seal-col" id="frag-list"></div>' +
    '<div class="house-list" id="house-list"></div>' +
    "</div>" +
    '<div class="feedback-msg" id="layer-feedback"></div>' +
    panelHtml +
    "</div>";

  const $fragList = document.querySelector("#frag-list");
  $fragList.innerHTML = "";
  shuffledFrags.forEach((f) => {
    const $card = document.createElement("button");
    $card.type = "button";
    $card.className = "frag-card seal-item";
    $card.id = "frag-" + f.id;
    $card.innerHTML = '<div class="seal-circle">' + f.symbol + '</div><div class="seal-caption">' + f.text + "</div>";
    $card.addEventListener("click", () => handleClickFragment(f.id, $card));
    $fragList.appendChild($card);
  });

  const $houseList = document.querySelector("#house-list");
  $houseList.innerHTML = "";
  HOUSES.forEach((h, idx) => {
    const $houseBtn = document.createElement("button");
    $houseBtn.type = "button";
    $houseBtn.className = "house-btn";
    $houseBtn.id = "house-" + idx;
    $houseBtn.innerHTML = '<span class="house-shield" id="house-shield-' + idx + '"></span><span class="house-info"><span>' + h.name + "</span></span>";
    $houseBtn.addEventListener("click", () => handleClickHouse(idx, $houseBtn));
    $houseList.appendChild($houseBtn);
  });
};

// ================= LAAG 4: Manuscriptvertaling =================
// Een simpel substitutie-geheimschrift: elk symbool staat voor één vaste letter.
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

// Verwerkt het indienen van het vertaal-formulier van laag 4.
const handleSubmitTranslation = (event) => {
  event.preventDefault();
  const $form = event.currentTarget;
  const formData = new FormData($form);
  const formValues = Object.fromEntries(formData);
  const val = (formValues.answer || "").trim().toUpperCase();
  if (val === TARGET_4) {
    solveLayer(TARGET_4, 'Het manuscript ontvouwt zich vanzelf. "' + TARGET_4 + '" — waarheid.');
  } else {
    showBadFeedback("Dat woord opent niets. Controleer de legenda nogmaals.");
    playShake(document.querySelector("#input4"));
  }
  $form.reset();
};

const renderLayer4 = (panelHtml) => {
  const legend = shuffle(CIPHER);
  const encoded = TARGET_4.split("")
    .map((letter) => CIPHER.find((c) => c.letter === letter).sym)
    .join(" ");

  const $layerContent = document.querySelector("#layer-content");
  $layerContent.innerHTML =
    '<div class="layer-inner">' +
    '<div class="layer-eyebrow">Laag IV van V</div>' +
    '<h2 class="layer-title">De Manuscriptvertaling</h2>' +
    '<div class="layer-flavor">' +
    "Een laatste manuscript ligt open op de lezenaar, geschreven in het geheimschrift van " +
    "de aartsarchivarissen. Gebruik de legenda om het verborgen woord te ontcijferen." +
    "</div>" +
    '<div class="manuscript-sheet parchment-texture">' +
    '<div class="legend-grid" id="legend"></div>' +
    '<div class="encoded-word">' + encoded + "</div>" +
    "</div>" +
    '<form class="answer-form" id="form4">' +
    '<label for="input4" class="visually-hidden">Jouw vertaling</label>' +
    '<input type="text" id="input4" name="answer" placeholder="Typ hier je vertaling..." autocomplete="off" required>' +
    '<button class="btn btn-primary" type="submit">Controleer</button>' +
    "</form>" +
    '<div class="feedback-msg" id="layer-feedback"></div>' +
    panelHtml +
    "</div>";

  const $legend = document.querySelector("#legend");
  $legend.innerHTML = "";
  legend.forEach((c) => {
    const $item = document.createElement("div");
    $item.className = "legend-cell";
    $item.innerHTML = '<span class="sym">' + c.sym + "</span>= " + c.letter;
    $legend.appendChild($item);
  });

  const $form4 = document.querySelector("#form4");
  $form4.addEventListener("submit", handleSubmitTranslation);
};

// ================= LAAG 5: De Finale Reeks =================
// Decoratieve achtergrond achter de fragment-overzichtsvakjes van laag 5.
const MANDALA_SVG =
  '<svg viewBox="0 0 300 300" class="mandala-bg">' +
  '<circle cx="150" cy="150" r="140" fill="none" stroke="var(--gold)" stroke-width="1"/>' +
  '<circle cx="150" cy="150" r="110" fill="none" stroke="var(--gold)" stroke-width="1"/>' +
  '<circle cx="150" cy="150" r="80" fill="none" stroke="var(--gold)" stroke-width="1"/>' +
  '<line x1="150" y1="10" x2="150" y2="290" stroke="var(--gold)" stroke-width="1"/>' +
  '<line x1="10" y1="150" x2="290" y2="150" stroke="var(--gold)" stroke-width="1"/>' +
  '<line x1="52" y1="52" x2="248" y2="248" stroke="var(--gold)" stroke-width="1"/>' +
  '<line x1="248" y1="52" x2="52" y2="248" stroke="var(--gold)" stroke-width="1"/>' +
  '<circle cx="150" cy="150" r="34" fill="none" stroke="var(--gold)" stroke-width="1.5"/>' +
  '<path d="M150 130 v28 M138 158 h24" stroke="var(--gold)" stroke-width="3" stroke-linecap="round"/>' +
  "</svg>";

// Tekent de vier rijen met vakjes die tonen welke fragment-codes al gevonden zijn.
const renderFragmentRows = () => {
  const labels = [
    { label: "Laag I — Coderadepuzzel", len: 3 },
    { label: "Laag II — Boekclassificatie", len: 6 },
    { label: "Laag III — Waszegelarchief", len: 4 },
    { label: "Laag IV — Manuscriptvertaling", len: 7 },
  ];
  return labels
    .map((l, i) => {
      const val = state.fragments[i];
      const chars = val ? val.split("") : Array(l.len).fill("?");
      const boxes = chars.map((c) => '<span class="fbox' + (val ? " filled" : "") + '">' + c + "</span>").join("");
      return '<div class="fragment-row"><div class="frow-label">' + l.label + '</div><div class="frow-boxes">' + boxes + "</div></div>";
    })
    .join("");
};

// Verwerkt het indienen van het Meestercode-formulier van laag 5.
const handleSubmitMasterCode = (event, finalCode) => {
  event.preventDefault();
  const $form = event.currentTarget;
  const formData = new FormData($form);
  const formValues = Object.fromEntries(formData);
  // spaties/streepjes worden genegeerd zodat opmaakverschillen niet fataal zijn
  const val = (formValues.answer || "").trim().toUpperCase().replace(/[\s-]/g, "");
  if (val === finalCode.toUpperCase()) {
    solveLayer(finalCode, "De kluisdeur ontgrendelt met een diepe, mechanische zucht...");
  } else {
    showBadFeedback("Het slot weigert. Controleer de formule en je verzamelde aanwijzingen.");
    playShake(document.querySelector("#input5"));
  }
  $form.reset();
};

// Bouwt laag 5 op: berekent de correcte Meestercode uit de vier fragmenten
// (laatste letter van I + volledige code van II + laatste cijfer van III +
// eerste 3 letters van IV) en toont de formule expliciet.
const renderLayer5 = (panelHtml) => {
  const f0 = state.fragments[0];
  const f1 = state.fragments[1];
  const f2 = state.fragments[2];
  const f3 = state.fragments[3];
  const finalCode = f0.slice(-1) + f1 + f2.slice(-1) + f3.slice(0, 3);

  const $layerContent = document.querySelector("#layer-content");
  $layerContent.innerHTML =
    '<div class="layer-inner">' +
    '<div class="layer-eyebrow">Laag V van V — Laatste Slot</div>' +
    '<h2 class="layer-title">De Finale Reeks</h2>' +
    '<div class="layer-flavor">' +
    'Een laatste inscriptie gloeit op: <em>"Voer de Meestercode in, samengesteld uit alles wat je vond."</em>' +
    "</div>" +
    '<div class="mandala-wrap">' +
    MANDALA_SVG +
    '<div class="fragment-rows">' + renderFragmentRows() + "</div>" +
    "</div>" +
    '<div class="formula-box">' +
    "Meestercode = <b>laatste letter</b> van Laag I&nbsp;+&nbsp;<b>volledige code</b> van Laag II&nbsp;+&nbsp;<b>laatste cijfer</b> van Laag III&nbsp;+&nbsp;<b>eerste 3 letters</b> van Laag IV" +
    "</div>" +
    '<form class="answer-form" id="form5">' +
    '<label for="input5" class="visually-hidden">Meestercode</label>' +
    '<input type="text" id="input5" name="answer" placeholder="Voer de Meestercode in..." autocomplete="off" required>' +
    '<button class="btn btn-primary" type="submit">Open de Kluis</button>' +
    "</form>" +
    '<div class="feedback-msg" id="layer-feedback"></div>' +
    panelHtml +
    "</div>";

  const $form5 = document.querySelector("#form5");
  $form5.addEventListener("submit", (event) => handleSubmitMasterCode(event, finalCode));
};

// ---------- winnen / verliezen ----------
// Stopt de timer, toont het winscherm en zet de eindtijd neer.
const winGame = () => {
  stopTimer();
  showScreen("screen-win");
  document.querySelector("#final-time").textContent = formatTime(state.elapsed);
  const $door = document.querySelector(".vault-door");
  $door.classList.remove("open");
  setTimeout(() => $door.classList.add("open"), 50);
};

// Toont het verliesscherm wanneer de timer op nul komt.
const loseGame = () => {
  showScreen("screen-lose");
};

// ---------- leaderboard ----------
// Leest het opgeslagen leaderboard uit localStorage.
const getLeaderboard = () => {
  try {
    const raw = localStorage.getItem(LB_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
};

// Voegt een nieuwe score toe, sorteert op tijd en bewaart enkel de beste 10.
const saveScore = (name) => {
  const scores = getLeaderboard();
  scores.push({ name: name.slice(0, 18) || "Anoniem", time: state.elapsed, date: new Date().toISOString() });
  scores.sort((a, b) => a.time - b.time);
  localStorage.setItem(LB_KEY, JSON.stringify(scores.slice(0, 10)));
};

// Tekent het leaderboard-scherm.
const renderLeaderboard = () => {
  const scores = getLeaderboard();
  const $content = document.querySelector("#lb-content");
  if (scores.length === 0) {
    $content.innerHTML = '<div class="lb-empty">Nog niemand is ontsnapt aan de Verboden Kluis...</div>';
    return;
  }
  const items = scores
    .map((s, i) => '<li><span class="lb-rank">' + (i + 1) + '.</span><span class="lb-name">' + s.name + '</span><span class="lb-time">' + formatTime(s.time) + "</span></li>")
    .join("");
  $content.innerHTML = '<ul class="lb-list">' + items + "</ul>";
};

// Verwerkt een klik op een van de "bekijk archief"-knoppen.
const handleClickShowLeaderboard = () => {
  renderLeaderboard();
  showScreen("screen-leaderboard");
};

// Verwerkt het indienen van het naam-formulier op het winscherm.
const handleSubmitScore = (event) => {
  event.preventDefault();
  const $form = event.currentTarget;
  const formData = new FormData($form);
  const formValues = Object.fromEntries(formData);
  const name = (formValues.playerName || "").trim() || "Anoniem";
  saveScore(name);
  $form.innerHTML = '<span style="color:#7FBF7F;">Tijd bewaard in het archief.</span>';
};

// ---------- reset / start ----------
// Zet alle spelstatus terug naar de beginwaarden, klaar voor een nieuwe poging.
const resetState = () => {
  stopTimer();
  state.layer = 0;
  state.timeLeft = TOTAL_TIME;
  state.hintsLeft = 3;
  state.fragments = ["", "", "", ""];
  state.elapsed = 0;
  document.querySelector("#hints-left").textContent = 3;
  document.querySelector("#btn-hint").disabled = false;
};

// Start een nieuwe poging: reset alles, toon het spelscherm en start de klok.
const beginGame = () => {
  resetState();
  updateTimerDisplay();
  showScreen("screen-game");
  goToLayer(0);
  startTimer();
};

// ---------- init ----------
// Koppelt alle statische knoppen aan hun handler en toont de starttijd.
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

  // Toon meteen "05:00" bij het laden van de pagina.
  updateTimerDisplay();
};

init();
