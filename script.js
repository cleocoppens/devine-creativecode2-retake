const TOTAL_TIME = 180;
const HINT_PENALTY = 60;
const LB_KEY = "verbodenKluisLeaderboard";

const state = {
  layer: 0,
  timeLeft: TOTAL_TIME,
  timerId: null,
  hintsLeft: 3,
  fragments: ["", "", ""],
  elapsed: 0,
};

const showScreen = (id) => {
  const $screens = document.querySelectorAll(".screen");
  $screens.forEach(($screen) => $screen.classList.remove("active"));
  const $target = document.querySelector(`#${id}`);
  $target.classList.add("active");
};

const shuffle = (arr) => {
  const copy = arr.slice();
  copy.sort(() => Math.random() - 0.5);
  return copy;
};

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);

const escapeHtml = (str) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatTime = (secs) => {
  const s = secs < 0 ? 0 : secs;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${pad(m)}:${pad(r)}`;
};

const flashSuccess = () => {
  const $flash = document.querySelector("#success-flash");
  $flash.classList.remove("play");
  setTimeout(() => $flash.classList.add("play"), 10);
};

const playShake = ($el) => {
  $el.classList.remove("shake");
  setTimeout(() => $el.classList.add("shake"), 10);
  setTimeout(() => $el.classList.remove("shake"), 500);
};

const updateTimerDisplay = () => {
  const $timerDisplay = document.querySelector("#timer-display");
  $timerDisplay.innerHTML = `<span class="timer-label">Tijd tot zuivering</span>${formatTime(state.timeLeft)}`;
  $timerDisplay.classList.toggle("warning", state.timeLeft <= 60);
};

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

const stopTimer = () => {
  if (state.timerId) {
    clearInterval(state.timerId);
  }
  state.timerId = null;
};

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

const LAYER_NAMES = ["Coderadeslot", "Waszegelarchief", "Manuscriptvertaling", "De Finale Reeks"];

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

const HINTS = [
  "Let op de eerste letter van elke zin in de tekst hierboven.",
  "Elke fragmenttekst beschrijft het wapendier van één huis. Welk dier hoort bij welk huis?",
  "Elk symbool staat steeds voor dezelfde letter. Bouw het woord op, symbool voor symbool, met de legenda.",
  "Kijk naar je Verzamelde Aanwijzingen rechts in beeld en volg de formule exact, teken voor teken.",
];

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

const showBadFeedback = (msg) => {
  const $feedback = document.querySelector("#layer-feedback");
  if ($feedback) {
    $feedback.textContent = msg;
    $feedback.classList.remove("ok");
    $feedback.classList.add("bad");
  }
};

const wheelState = [0, 0, 0];
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const TARGET_1 = "ARX";

const handleClickWheelButton = ($btn) => {
  const idx = parseInt($btn.dataset.idx, 10);
  const dir = parseInt($btn.dataset.dir, 10);
  wheelState[idx] = wheelState[idx] + dir;
  if (wheelState[idx] < 0) wheelState[idx] = ALPHA.length - 1;
  if (wheelState[idx] >= ALPHA.length) wheelState[idx] = 0;
  document.querySelector(`#dial-current-${idx}`).textContent = ALPHA[wheelState[idx]];
};

const handleClickCheckWheels = () => {
  const guess = `${ALPHA[wheelState[0]]}${ALPHA[wheelState[1]]}${ALPHA[wheelState[2]]}`;
  if (guess === TARGET_1) {
    solveLayer(TARGET_1, "De cijferwielen klikken vast. ARX, de Latijnse burcht. Toegang verleend.");
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

const handleClickFragment = (fragId, $card) => {
  if ($card.classList.contains("solved")) return;
  document.querySelectorAll(".frag-card").forEach(($c) => $c.classList.remove("selected"));
  $card.classList.add("selected");
  selectedFrag = fragId;
};

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

const renderFragmentRows = () => {
  const labels = [
    { label: "Laag I: Coderadeslot", len: 3 },
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
      <div class="fragment-rows">${renderFragmentRows()}</div>
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

const winGame = () => {
  stopTimer();
  showScreen("screen-win");
  document.querySelector("#final-time").textContent = formatTime(state.elapsed);
  const $door = document.querySelector(".vault-door");
  $door.classList.remove("open");
  setTimeout(() => $door.classList.add("open"), 50);
};

const loseGame = () => {
  showScreen("screen-lose");
};

const getLeaderboard = () => {
  try {
    const raw = localStorage.getItem(LB_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
};

const saveScore = (name) => {
  const scores = getLeaderboard();
  scores.push({ name: name.slice(0, 18) || "Anoniem", time: state.elapsed, date: new Date().toISOString() });
  scores.sort((a, b) => a.time - b.time);
  localStorage.setItem(LB_KEY, JSON.stringify(scores.slice(0, 10)));
};

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

const handleClickShowLeaderboard = () => {
  renderLeaderboard();
  showScreen("screen-leaderboard");
};

const handleSubmitScore = (event) => {
  event.preventDefault();
  const $form = event.currentTarget;
  const formData = new FormData($form);
  const formValues = Object.fromEntries(formData);
  const name = (formValues.playerName || "").trim() || "Anoniem";
  saveScore(name);
  $form.innerHTML = `<span style="color:#7FBF7F;">Tijd bewaard in het archief.</span>`;
};

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

const beginGame = () => {
  resetState();
  updateTimerDisplay();
  showScreen("screen-game");
  goToLayer(0);
  startTimer();
};

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
