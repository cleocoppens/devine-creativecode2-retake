(() => {
  "use strict";

  // ---------- config ----------
  const TOTAL_TIME = 300; // countdown duur in seconden (5 minuten)
  const HINT_PENALTY = 60; // seconden die een hint van de resterende tijd afhaalt
  const LB_KEY = "verbodenKluisLeaderboard"; // localStorage-sleutel voor het leaderboard

  // ---------- game state ----------
  // Centraal object dat de volledige voortgang van een sessie bijhoudt.
  const state = {
    layer: 0, // index van de huidige laag (0 t/m 4)
    timeLeft: TOTAL_TIME, // resterende seconden op de countdown
    timerId: null, // referentie naar de actieve setInterval, nodig om te kunnen stoppen
    hintsLeft: 3, // aantal hints dat de speler nog mag gebruiken
    running: false, // of de timer op dit moment loopt
    fragments: ["", "", "", ""], // opgeloste code per laag (I t/m IV), gebruikt voor de finale formule
    startTimestamp: null, // moment waarop de huidige poging begon
    elapsed: 0, // verstreken seconden sinds start, wordt de eindtijd bij winst
  };

  // ---------- generic helpers ----------
  // Korte alias voor querySelector/querySelectorAll, scheelt herhaling overal in dit bestand.
  const $ = (sel) => document.querySelector(sel);
  const $all = (sel) => Array.from(document.querySelectorAll(sel));

  // Wisselt van scherm door de "active" class te verplaatsen; CSS regelt de zichtbaarheid.
  const showScreen = (id) => {
    $all(".screen").forEach((s) => s.classList.remove("active"));
    $(`#${id}`).classList.add("active");
  };

  // Fisher-Yates shuffle: husselt een array zonder het origineel aan te passen.
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Zet seconden om naar een leesbare MM:SS-notatie voor de timer en het leaderboard.
  const formatTime = (secs) => {
    const s = Math.max(0, secs);
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const r = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${r}`;
  };

  // Speelt de gouden flits-animatie af bij elke correcte oplossing (micro-interactie).
  // De reflow via offsetWidth dwingt de browser om de animatie opnieuw te starten,
  // ook als de vorige flits nog niet helemaal was uitgefade.
  const flashSuccess = () => {
    const el = $("#success-flash");
    el.classList.remove("play");
    void el.offsetWidth;
    el.classList.add("play");
  };

  // ---------- timer ----------
  // Ververst de klokweergave in de header en schakelt de rode "warning"-stijl
  // in zodra er nog maar 60 seconden of minder over zijn.
  const updateTimerDisplay = () => {
    const wrap = $("#timer-display");
    wrap.innerHTML = `<span class="timer-label">Tijd tot zuivering</span>${formatTime(state.timeLeft)}`;
    wrap.classList.toggle("warning", state.timeLeft <= 60);
  };

  // Start de countdown: elke seconde gaat timeLeft omlaag en elapsed omhoog.
  // Bereikt de klok nul, dan stopt de timer en verliest de speler.
  const startTimer = () => {
    state.running = true;
    state.startTimestamp = Date.now();
    state.timerId = setInterval(() => {
      state.timeLeft -= 1;
      state.elapsed += 1;
      updateTimerDisplay();
      if (state.timeLeft <= 0) {
        stopTimer();
        loseGame();
      }
    }, 1000);
  };

  // Zet de lopende setInterval stil. Belangrijk om te doen bij winst/verlies/herstart,
  // anders blijven er "spooktimers" doorlopen op de achtergrond.
  const stopTimer = () => {
    state.running = false;
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
  };

  // Trekt de tijdstraf van een hint af van de klok en laat de timer even
  // in de "warning"-stijl flitsen als visuele feedback op het tijdverlies.
  const applyPenalty = (secs) => {
    state.timeLeft = Math.max(1, state.timeLeft - secs);
    updateTimerDisplay();
    const wrap = $("#timer-display");
    wrap.classList.add("warning");
    setTimeout(() => {
      if (state.timeLeft > 60) wrap.classList.remove("warning");
    }, 700);
  };

  // ---------- progress + clues ----------
  const LAYER_NAMES = ["Coderadepuzzel", "Boekclassificatie", "Waszegelarchief", "Manuscriptvertaling", "De Finale Reeks"];

  // Bouwt de rij voortgangsstippen in de header: opgeloste lagen krijgen "done",
  // de actieve laag krijgt "current" (en pulseert via CSS).
  const renderProgress = () => {
    const dots = $("#progress-dots");
    dots.innerHTML = "";
    LAYER_NAMES.forEach((_, i) => {
      const d = document.createElement("div");
      d.className = "dot" + (i < state.layer ? " done" : i === state.layer ? " current" : "");
      dots.appendChild(d);
    });
  };

  // Toont de tot nu toe verzamelde fragment-codes in de zijbalk.
  // Nog niet opgeloste lagen tonen "??????" zodat spelers zien wat er nog ontbreekt.
  const renderClues = () => {
    const list = $("#clues-list");
    list.innerHTML = "";
    const labels = ["Laag I", "Laag II", "Laag III", "Laag IV"];
    labels.forEach((label, i) => {
      const item = document.createElement("div");
      item.className = "clue-item";
      const val = state.fragments[i];
      item.innerHTML = `<span class="clue-label">${label}</span><span class="clue-value ${val ? "" : "unknown"}">${val || "??????"}</span>`;
      list.appendChild(item);
    });
  };

  // ---------- hint system ----------
  // Eén hint per laag, op index gekoppeld aan state.layer.
  const HINTS = [
    "Let op de eerste letter van elke zin in de tekst hierboven.",
    "De boeken staan niet op alfabet, maar op ouderdom — kijk naar het jaartal op elke rug.",
    "Elke fragmenttekst beschrijft het wapendier van één huis. Welk dier hoort bij welk huis?",
    "Elk symbool staat steeds voor dezelfde letter. Bouw het woord op, symbool voor symbool, met de legenda.",
    "Kijk naar je Verzamelde Aanwijzingen rechts in beeld en volg de formule exact, teken voor teken.",
  ];

  // Verwerkt een klik op de hintknop: telt hints af, trekt de tijdstraf af,
  // toont de hinttekst in het paneel van de huidige laag en schudt de knop
  // als micro-interactie. Zijn alle hints op, dan wordt de knop uitgeschakeld.
  const useHint = () => {
    if (state.hintsLeft <= 0) return;
    state.hintsLeft -= 1;
    $("#hints-left").textContent = state.hintsLeft;
    applyPenalty(HINT_PENALTY);
    const btn = $("#btn-hint");
    btn.classList.remove("shake");
    void btn.offsetWidth;
    btn.classList.add("shake");
    setTimeout(() => btn.classList.remove("shake"), 500);
    const panel = $("#hint-panel");
    if (panel) {
      panel.textContent = "💡 " + HINTS[state.layer];
      panel.classList.add("show");
    }
    if (state.hintsLeft === 0) btn.disabled = true;
  };

  // ---------- layer advance ----------
  // Wisselt naar laag n: werkt de voortgang/zijbalk bij en roept de juiste
  // render-functie op (renderLayer1 t/m renderLayer5 staan verderop in dit bestand).
  const goToLayer = (n) => {
    state.layer = n;
    renderProgress();
    renderClues();
    const panelHtml = `<div class="hint-panel" id="hint-panel"></div>`;
    const renderers = [renderLayer1, renderLayer2, renderLayer3, renderLayer4, renderLayer5];
    renderers[n](panelHtml);
  };

  // Wordt aangeroepen zodra een laag correct is opgelost: slaat de fragmentcode op,
  // speelt de succes-flits af en toont positieve feedback. Na een korte vertraging
  // (zodat de speler de feedback kan lezen) gaat het spel naar de volgende laag,
  // of naar het winscherm als dit de laatste laag was.
  const solveLayer = (fragmentValue, feedbackMsg) => {
    state.fragments[state.layer] = fragmentValue;
    flashSuccess();
    const fb = $("#layer-feedback");
    if (fb) {
      fb.textContent = feedbackMsg || "Correct. De volgende laag ontgrendelt...";
      fb.classList.remove("bad");
      fb.classList.add("ok");
    }
    setTimeout(() => {
      if (state.layer < 4) {
        goToLayer(state.layer + 1);
      } else {
        winGame();
      }
    }, 1300);
  };

  // Toont foutfeedback onder de huidige laag (rode tekst + shake via CSS).
  const showBadFeedback = (msg) => {
    const fb = $("#layer-feedback");
    if (fb) {
      fb.textContent = msg;
      fb.classList.remove("ok");
      fb.classList.add("bad");
    }
  };

  // ================= LAYER 1: Coderadepuzzel =================
  // Drie ronddraaiende letterwielen die de speler naar de code "ARX" moet zetten.
  // De code staat verstopt als acrostichon: de eerste letter van elke zin in de
  // flavourtekst (Aan.../Radeloos.../X markeert...) spelt A-R-X.
  const wheelState = [0, 0, 0]; // huidige letterindex (0-25) per wiel
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const TARGET_1 = "ARX";
  const ANGLE_STEP = 360 / ALPHA.length; // graden tussen twee opeenvolgende letters op het wiel

  // Genereert de SVG voor één draaibaar letterwiel: een cirkel van 26 letters die
  // via CSS-transform geroteerd wordt tot de huidige letter bovenaan staat.
  const buildDialSVG = (idx) => {
    const cx = 100, cy = 100, r = 78;
    const letters = ALPHA.split("").map((l, i) => {
      const angle = i * ANGLE_STEP;
      const rad = ((angle - 90) * Math.PI) / 180;
      const x = (cx + r * Math.cos(rad)).toFixed(1);
      const y = (cy + r * Math.sin(rad)).toFixed(1);
      return `<text x="${x}" y="${y}" transform="rotate(${angle.toFixed(2)} ${x} ${y})" text-anchor="middle" class="dial-letter">${l}</text>`;
    }).join("");
    // vier sierklinknagels rond de rand van het wiel, puur decoratief
    const rivets = [45, 135, 225, 315].map((a) => {
      const rad = (a * Math.PI) / 180;
      const x = (cx + 90 * Math.cos(rad)).toFixed(1);
      const y = (cy + 90 * Math.sin(rad)).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="3" class="dial-rivet"/>`;
    }).join("");
    return `
      <svg viewBox="0 0 200 200" class="dial-svg" id="dial-${idx}">
        <circle cx="100" cy="100" r="96" class="dial-outer"/>
        ${rivets}
        <circle cx="100" cy="100" r="86" class="dial-face"/>
        <g class="dial-ring" id="dial-ring-${idx}" style="transform:rotate(${(-wheelState[idx] * ANGLE_STEP).toFixed(2)}deg)">${letters}</g>
        <circle cx="100" cy="100" r="36" class="dial-center"/>
        <text x="100" y="109" text-anchor="middle" class="dial-current" id="dial-current-${idx}">${ALPHA[wheelState[idx]]}</text>
        <polygon points="100,2 91,22 109,22" class="dial-pointer"/>
      </svg>
    `;
  };

  // Bouwt laag 1 op: reset de wielen naar "A", rendert de puzzel-HTML en koppelt
  // de klik-events voor de ◀/▶ knoppen (roteren) en de "Ontgrendel"-knop (controle).
  const renderLayer1 = (panelHtml) => {
    wheelState[0] = 0; wheelState[1] = 0; wheelState[2] = 0;
    $("#layer-content").innerHTML = `
      <div class="layer-inner">
        <div class="layer-eyebrow">Laag I van V</div>
        <h2 class="layer-title">Het Coderadeslot</h2>
        <div class="layer-flavor">
          <span class="acro-letter">A</span>an de rand van het weten wacht een zware deur.<br>
          <span class="acro-letter">R</span>adeloos zoekt de leerling-archivaris naar een teken in het steen.<br>
          <span class="acro-letter">X</span> markeert nooit toeval — lees de eerste letters van dit vers, van boven naar beneden.
        </div>
        <div class="wheels" id="wheels"></div>
        <div style="text-align:center;">
          <button class="btn btn-primary" id="btn-check1" type="button">Ontgrendel</button>
        </div>
        <div class="feedback-msg" id="layer-feedback"></div>
        ${panelHtml}
      </div>
    `;
    const wrap = $("#wheels");
    wrap.innerHTML = "";
    [0, 1, 2].forEach((idx) => {
      const w = document.createElement("div");
      w.className = "wheel";
      w.innerHTML = `
        ${buildDialSVG(idx)}
        <div class="wheel-btns">
          <button data-idx="${idx}" data-dir="-1" type="button">◀</button>
          <button data-idx="${idx}" data-dir="1" type="button">▶</button>
        </div>
      `;
      wrap.appendChild(w);
    });
    // Elke ◀/▶ knop draait zijn eigen wiel één letter verder en laat de
    // middelste letter kort fade-en zodat de wissel niet abrupt aanvoelt.
    $all(".wheel-btns button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const dir = parseInt(btn.dataset.dir, 10);
        wheelState[idx] = (wheelState[idx] + dir + ALPHA.length) % ALPHA.length;
        const ring = $(`#dial-ring-${idx}`);
        const cur = $(`#dial-current-${idx}`);
        ring.style.transform = `rotate(${(-wheelState[idx] * ANGLE_STEP).toFixed(2)}deg)`;
        cur.style.opacity = "0";
        setTimeout(() => { cur.textContent = ALPHA[wheelState[idx]]; cur.style.opacity = "1"; }, 150);
      });
    });
    $("#btn-check1").addEventListener("click", () => {
      const guess = wheelState.map((i) => ALPHA[i]).join("");
      if (guess === TARGET_1) {
        solveLayer(TARGET_1, "De cijferwielen klikken vast. ARX — de Latijnse burcht. Toegang verleend.");
      } else {
        showBadFeedback("De wielen weigeren te bewegen. Dit is niet de juiste code.");
        $all(".dial-svg").forEach((el) => {
          el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
        });
      }
    });
  };

  // ================= LAYER 2: Boekclassificatie =================
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
  let bookSelection = []; // volgorde waarin de speler tot nu toe boeken heeft aangeklikt (array van id's)

  // Bouwt laag 2 op: reset de selectie en rendert de lege plank + het boekenstapeltje.
  const renderLayer2 = (panelHtml) => {
    bookSelection = [];
    $("#layer-content").innerHTML = `
      <div class="layer-inner">
        <div class="layer-eyebrow">Laag II van V</div>
        <h2 class="layer-title">De Boekclassificatie</h2>
        <div class="layer-flavor">
          Zes verboden boeken staan door elkaar op de plank gegooid. De plank ontgrendelt
          alleen als ze op ouderdom staan: van het oudste jaartal naar het jongste. Klik de
          boeken in de juiste volgorde aan.
        </div>
        <div class="shelf" id="shelf"></div>
        <div class="book-pile" id="book-pile"></div>
        <div class="feedback-msg" id="layer-feedback"></div>
        ${panelHtml}
      </div>
    `;
    renderShelf();
    renderBookPile();
  };

  // Tekent de zes lege/gevulde plank-slots met pijltjes ertussen, op basis van
  // hoeveel boeken de speler al gekozen heeft (bookSelection.length).
  const renderShelf = () => {
    const shelf = $("#shelf");
    shelf.innerHTML = "";
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement("div");
      slot.className = "slot" + (bookSelection[i] !== undefined ? " filled" : "");
      slot.id = `slot-${i}`;
      slot.textContent = bookSelection[i] !== undefined ? (i + 1) : "";
      shelf.appendChild(slot);
      if (i < 5) {
        const arrow = document.createElement("span");
        arrow.className = "slot-arrow";
        arrow.textContent = "▶";
        shelf.appendChild(arrow);
      }
    }
  };

  // Tekent de stapel klikbare boekkaarten. De volgorde van de stapel wordt één keer
  // gehusseld en daarna vastgehouden in een data-attribuut, zodat een re-render
  // (bv. na een foute poging) de kaarten niet opnieuw door elkaar gooit.
  const renderBookPile = () => {
    const pile = $("#book-pile");
    pile.innerHTML = "";
    const order = pile.dataset.order ? JSON.parse(pile.dataset.order) : shuffle(BOOKS.map((b) => b.id));
    pile.dataset.order = JSON.stringify(order);
    order.forEach((id) => {
      const book = BOOKS.find((b) => b.id === id);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "book-card" + (bookSelection.includes(id) ? " used" : "");
      card.style.setProperty("--book-color", book.color);
      card.innerHTML = `<span class="book-symbol">${book.symbol}</span><span class="book-title">${book.title}</span><span class="book-year">${book.year}</span>`;
      card.addEventListener("click", () => onBookClick(id));
      pile.appendChild(card);
    });
  };

  // Verwerkt een klik op een boek: voegt het toe aan de selectie en checkt de
  // volgorde zodra alle zes gekozen zijn. Correct → los de laag op en toon de
  // gevormde code. Fout → shake alle slots en reset de selectie na een korte pauze.
  const onBookClick = (id) => {
    if (bookSelection.includes(id) || bookSelection.length >= 6) return;
    bookSelection.push(id);
    renderShelf();
    renderBookPile();
    if (bookSelection.length === 6) {
      const correctOrder = [0, 1, 2, 3, 4, 5]; // boeken staan al chronologisch gesorteerd op id
      const isCorrect = bookSelection.every((v, i) => v === correctOrder[i]);
      if (isCorrect) {
        const code = correctOrder.map((id2) => BOOKS.find((b) => b.id === id2).letter).join("");
        $all(".slot").forEach((s, i) => { s.textContent = BOOKS[correctOrder[i]].letter; });
        solveLayer(code, `De boeken schuiven vast in hun sleuven. Samen vormen ze: ${code}.`);
      } else {
        showBadFeedback("Dit is niet de juiste volgorde van ouderdom. De plank reset zichzelf.");
        $all(".slot").forEach((s) => { s.classList.add("shake"); });
        setTimeout(() => {
          bookSelection = [];
          renderShelf();
          renderBookPile();
        }, 650);
      }
    }
  };

  // ================= LAYER 3: Waszegelarchief =================
  // Vier fragmenten (elk met een dier-symbool en een korte omschrijving) moeten
  // gekoppeld worden aan het bijbehorende adellijke huis. Zijn alle vier juist
  // gekoppeld, dan vormen de huis-cijfers samen de code voor deze laag.
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
  let sealAssignments = {}; // { fragmentId: houseIdx } voor elk al correct gekoppeld fragment
  let selectedFrag = null; // id van het fragment dat de speler nu geselecteerd heeft

  // Bouwt laag 3 op: reset de koppelingen, hussel de fragmenten (zodat ze niet
  // steeds in dezelfde volgorde als de huizen staan) en render beide kolommen.
  const renderLayer3 = (panelHtml) => {
    sealAssignments = {};
    selectedFrag = null;
    const shuffledFrags = shuffle(FRAGMENTS);
    $("#layer-content").innerHTML = `
      <div class="layer-inner">
        <div class="layer-eyebrow">Laag III van V</div>
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
    const fragList = $("#frag-list");
    fragList.innerHTML = "";
    shuffledFrags.forEach((f) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "frag-card seal-item";
      card.id = `frag-${f.id}`;
      card.innerHTML = `<div class="seal-circle">${f.symbol}</div><div class="seal-caption">${f.text}</div>`;
      card.addEventListener("click", () => onFragClick(f.id, card));
      fragList.appendChild(card);
    });
    const houseList = $("#house-list");
    houseList.innerHTML = "";
    HOUSES.forEach((h, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "house-btn";
      btn.id = `house-${idx}`;
      btn.innerHTML = `<span class="house-shield" id="house-shield-${idx}"></span><span class="house-info"><span>${h.name}</span></span>`;
      btn.addEventListener("click", () => onHouseClick(idx, btn));
      houseList.appendChild(btn);
    });
  };

  // Selecteert een fragmentkaart (visueel gemarkeerd) zodat de speler daarna
  // een huis kan aanklikken om de koppeling te maken.
  const onFragClick = (fragId, cardEl) => {
    if (cardEl.classList.contains("solved")) return;
    $all(".frag-card").forEach((c) => c.classList.remove("selected"));
    cardEl.classList.add("selected");
    selectedFrag = fragId;
  };

  // Verwerkt een klik op een huis: bij een juiste koppeling worden fragment en
  // huis als "solved" gemarkeerd en verschijnt het dier-symbool op het schild.
  // Zijn alle vier gekoppeld, dan wordt de laag opgelost. Bij een foute koppeling
  // schudden beide elementen kort en wordt de selectie leeggemaakt.
  const onHouseClick = (houseIdx, btnEl) => {
    if (selectedFrag === null || btnEl.classList.contains("solved")) return;
    const frag = FRAGMENTS.find((f) => f.id === selectedFrag);
    const fragCard = $(`#frag-${selectedFrag}`);
    if (frag.houseIdx === houseIdx) {
      fragCard.classList.remove("selected");
      fragCard.classList.add("solved");
      btnEl.classList.add("solved");
      $(`#house-shield-${houseIdx}`).textContent = HOUSES[houseIdx].symbol;
      sealAssignments[selectedFrag] = houseIdx;
      selectedFrag = null;
      const solvedCount = Object.keys(sealAssignments).length;
      if (solvedCount === 4) {
        const code = HOUSES.map((h) => h.digit).join("");
        solveLayer(code, `Alle zegels rusten op hun plek. Het slot fluistert een getal: ${code}.`);
      }
    } else {
      fragCard.classList.add("shake");
      btnEl.classList.add("shake");
      setTimeout(() => {
        fragCard.classList.remove("shake", "selected");
        btnEl.classList.remove("shake");
      }, 500);
      selectedFrag = null;
    }
  };

  // ================= LAYER 4: Manuscriptvertaling =================
  // Een simpel substitutie-geheimschrift: elk symbool staat voor één vaste letter.
  // De speler krijgt het gecodeerde woord ("VERITAS") plus een legenda en moet
  // het antwoord met de hand ontcijferen en intypen.
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

  // Bouwt laag 4 op: hussel de legenda-volgorde (puur cosmetisch, de koppeling
  // symbool↔letter blijft hetzelfde) en zet het doelwoord om in symbolen.
  const renderLayer4 = (panelHtml) => {
    const legend = shuffle(CIPHER);
    const encoded = TARGET_4.split("").map((l) => CIPHER.find((c) => c.letter === l).sym).join(" ");
    $("#layer-content").innerHTML = `
      <div class="layer-inner">
        <div class="layer-eyebrow">Laag IV van V</div>
        <h2 class="layer-title">De Manuscriptvertaling</h2>
        <div class="layer-flavor">
          Een laatste manuscript ligt open op de lezenaar, geschreven in het geheimschrift van
          de aartsarchivarissen. Gebruik de legenda om het verborgen woord te ontcijferen.
        </div>
        <div class="manuscript-sheet parchment-texture">
          <div class="legend-grid" id="legend"></div>
          <div class="encoded-word">${encoded}</div>
        </div>
        <form class="answer-form" id="form4">
          <label for="input4" class="visually-hidden">Jouw vertaling</label>
          <input type="text" id="input4" name="answer" placeholder="Typ hier je vertaling..." autocomplete="off" required>
          <button class="btn btn-primary" type="submit">Controleer</button>
        </form>
        <div class="feedback-msg" id="layer-feedback"></div>
        ${panelHtml}
      </div>
    `;
    const legendEl = $("#legend");
    legendEl.innerHTML = "";
    legend.forEach((c) => {
      const item = document.createElement("div");
      item.className = "legend-cell";
      item.innerHTML = `<span class="sym">${c.sym}</span>= ${c.letter}`;
      legendEl.appendChild(item);
    });
    // Formulier wordt afgehandeld met FormData zodat de invoer op de juiste
    // manier (via het name-attribuut "answer") wordt uitgelezen, zoals de
    // cursus voorschrijft. preventDefault voorkomt de standaard paginaherlaad.
    $("#form4").addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const { answer } = Object.fromEntries(formData);
      const val = (answer || "").trim().toUpperCase();
      if (val === TARGET_4) {
        solveLayer(TARGET_4, `Het manuscript ontvouwt zich vanzelf. "${TARGET_4}" — waarheid.`);
      } else {
        showBadFeedback("Dat woord opent niets. Controleer de legenda nogmaals.");
        $("#input4").classList.add("shake");
        setTimeout(() => $("#input4").classList.remove("shake"), 500);
      }
      e.currentTarget.reset();
    });
  };

  // ================= LAYER 5: De Finale Reeks =================
  // Decoratieve mandala-achtergrond (puur SVG, geen puzzel-logica) achter de
  // fragment-overzichtsvakjes van laag 5.
  const MANDALA_SVG = `
    <svg viewBox="0 0 300 300" class="mandala-bg">
      <circle cx="150" cy="150" r="140" fill="none" stroke="var(--gold)" stroke-width="1"/>
      <circle cx="150" cy="150" r="110" fill="none" stroke="var(--gold)" stroke-width="1"/>
      <circle cx="150" cy="150" r="80" fill="none" stroke="var(--gold)" stroke-width="1"/>
      ${Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x1 = 150 + 80 * Math.cos(a), y1 = 150 + 80 * Math.sin(a);
        const x2 = 150 + 140 * Math.cos(a), y2 = 150 + 140 * Math.sin(a);
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--gold)" stroke-width="1"/>`;
      }).join("")}
      <circle cx="150" cy="150" r="34" fill="none" stroke="var(--gold)" stroke-width="1.5"/>
      <path d="M150 130 v28 M138 158 h24" stroke="var(--gold)" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `;

  // Tekent de vier rijen met vakjes die tonen welke fragment-codes de speler al
  // heeft (gevuld) en welke er nog ontbreken (vraagtekens), als geheugensteun
  // voor het invullen van de Meestercode-formule.
  const renderFragmentRows = () => {
    const labels = [
      { label: "Laag I — Coderadepuzzel", len: 3 },
      { label: "Laag II — Boekclassificatie", len: 6 },
      { label: "Laag III — Waszegelarchief", len: 4 },
      { label: "Laag IV — Manuscriptvertaling", len: 7 },
    ];
    return labels.map((l, i) => {
      const val = state.fragments[i];
      const chars = val ? val.split("") : Array(l.len).fill("?");
      const boxes = chars.map((c) => `<span class="fbox${val ? " filled" : ""}">${c}</span>`).join("");
      return `<div class="fragment-row"><div class="frow-label">${l.label}</div><div class="frow-boxes">${boxes}</div></div>`;
    }).join("");
  };

  // Bouwt laag 5 op: berekent vooraf de correcte Meestercode uit de vier
  // verzamelde fragmenten (laatste letter van I + volledige code van II +
  // laatste cijfer van III + eerste 3 letters van IV) en toont de formule
  // expliciet, zodat de speler de puzzel zelf kan samenstellen.
  const renderLayer5 = (panelHtml) => {
    const finalCode =
      state.fragments[0].slice(-1) +
      state.fragments[1] +
      state.fragments[2].slice(-1) +
      state.fragments[3].slice(0, 3);
    $("#layer-content").innerHTML = `
      <div class="layer-inner">
        <div class="layer-eyebrow">Laag V van V — Laatste Slot</div>
        <h2 class="layer-title">De Finale Reeks</h2>
        <div class="layer-flavor">
          Een laatste inscriptie gloeit op: <em>"Voer de Meestercode in, samengesteld uit alles wat je vond."</em>
        </div>
        <div class="mandala-wrap">
          ${MANDALA_SVG}
          <div class="fragment-rows">${renderFragmentRows()}</div>
        </div>
        <div class="formula-box">
          Meestercode = <b>laatste letter</b> van Laag I&nbsp;+&nbsp;<b>volledige code</b> van Laag II&nbsp;+&nbsp;<b>laatste cijfer</b> van Laag III&nbsp;+&nbsp;<b>eerste 3 letters</b> van Laag IV
        </div>
        <form class="answer-form" id="form5">
          <label for="input5" class="visually-hidden">Meestercode</label>
          <input type="text" id="input5" name="answer" placeholder="Voer de Meestercode in..." autocomplete="off" required>
          <button class="btn btn-primary" type="submit">Open de Kluis</button>
        </form>
        <div class="feedback-msg" id="layer-feedback"></div>
        ${panelHtml}
      </div>
    `;
    $("#form5").addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const { answer } = Object.fromEntries(formData);
      // spaties/streepjes worden genegeerd zodat opmaakverschillen niet fataal zijn
      const val = (answer || "").trim().toUpperCase().replace(/[\s-]/g, "");
      if (val === finalCode.toUpperCase()) {
        solveLayer(finalCode, "De kluisdeur ontgrendelt met een diepe, mechanische zucht...");
      } else {
        showBadFeedback("Het slot weigert. Controleer de formule en je verzamelde aanwijzingen.");
        $("#input5").classList.add("shake");
        setTimeout(() => $("#input5").classList.remove("shake"), 500);
      }
      e.currentTarget.reset();
    });
  };

  // ---------- win / lose ----------
  // Stopt de timer, toont het winscherm en zet de eindtijd neer.
  // De kluisdeur-animatie wordt bewust met een dubbele requestAnimationFrame
  // getriggerd: zonder die truc start de overgang (display:none → flex) en de
  // "open"-class tegelijk, waardoor de browser de animatie niet zichtbaar afspeelt.
  const winGame = () => {
    stopTimer();
    showScreen("screen-win");
    $("#final-time").textContent = formatTime(state.elapsed);
    const door = $(".vault-door");
    door.classList.remove("open");
    requestAnimationFrame(() => requestAnimationFrame(() => door.classList.add("open")));
  };

  // Toont het verliesscherm wanneer de timer op nul komt.
  const loseGame = () => {
    showScreen("screen-lose");
  };

  // ---------- leaderboard ----------
  // Leest het opgeslagen leaderboard uit localStorage. Bij ontbrekende of
  // corrupte data wordt gewoon een lege lijst teruggegeven.
  const getLeaderboard = () => {
    try {
      const raw = localStorage.getItem(LB_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  };

  // Voegt een nieuwe score toe, sorteert op tijd (snelste eerst) en bewaart
  // enkel de beste 10 in localStorage.
  const saveScore = (name) => {
    const scores = getLeaderboard();
    scores.push({ name: name.slice(0, 18) || "Anoniem", time: state.elapsed, date: new Date().toISOString() });
    scores.sort((a, b) => a.time - b.time);
    localStorage.setItem(LB_KEY, JSON.stringify(scores.slice(0, 10)));
  };

  // Tekent het leaderboard-scherm: een lege-staat bericht als er nog geen
  // scores zijn, anders een genummerde lijst met naam en tijd.
  const renderLeaderboard = () => {
    const scores = getLeaderboard();
    const content = $("#lb-content");
    if (scores.length === 0) {
      content.innerHTML = `<div class="lb-empty">Nog niemand is ontsnapt aan de Verboden Kluis...</div>`;
      return;
    }
    const list = document.createElement("ul");
    list.className = "lb-list";
    scores.forEach((s, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="lb-rank">${i + 1}.</span><span class="lb-name">${s.name}</span><span class="lb-time">${formatTime(s.time)}</span>`;
      list.appendChild(li);
    });
    content.innerHTML = "";
    content.appendChild(list);
  };

  // ---------- reset / init ----------
  // Zet alle spelstatus terug naar de beginwaarden, klaar voor een nieuwe poging.
  const resetState = () => {
    stopTimer();
    state.layer = 0;
    state.timeLeft = TOTAL_TIME;
    state.hintsLeft = 3;
    state.fragments = ["", "", "", ""];
    state.elapsed = 0;
    $("#hints-left").textContent = 3;
    $("#btn-hint").disabled = false;
  };

  // Start een nieuwe poging: reset alles, toon het spelscherm, ga naar laag 1
  // en laat de countdown lopen.
  const beginGame = () => {
    resetState();
    updateTimerDisplay();
    showScreen("screen-game");
    goToLayer(0);
    startTimer();
  };

  // ---------- event wiring ----------
  // Koppelt alle statische knoppen (die al in de HTML staan) aan hun handler.
  // De knoppen die per laag dynamisch worden aangemaakt, krijgen hun eigen
  // listener in de renderLayerX-functies hierboven.
  $("#btn-start").addEventListener("click", beginGame);
  $("#btn-show-leaderboard").addEventListener("click", () => { renderLeaderboard(); showScreen("screen-leaderboard"); });
  $("#btn-lb-back").addEventListener("click", () => showScreen("screen-intro"));
  $("#btn-hint").addEventListener("click", useHint);

  // Naam-formulier op het winscherm: bewaart de score en vervangt het formulier
  // door een bevestigingstekst zodat niet twee keer dezelfde tijd kan worden opgeslagen.
  $("#score-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const { playerName } = Object.fromEntries(formData);
    saveScore((playerName || "").trim() || "Anoniem");
    e.currentTarget.innerHTML = `<span style="color:#7FBF7F;">Tijd bewaard in het archief.</span>`;
  });
  $("#btn-win-leaderboard").addEventListener("click", () => { renderLeaderboard(); showScreen("screen-leaderboard"); });
  $("#btn-win-again").addEventListener("click", () => showScreen("screen-intro"));
  $("#btn-lose-again").addEventListener("click", beginGame);
  $("#btn-lose-leaderboard").addEventListener("click", () => { renderLeaderboard(); showScreen("screen-leaderboard"); });

  // Toon meteen "05:00" bij het laden van de pagina, nog voordat er gespeeld wordt.
  updateTimerDisplay();
})();
