'use strict';

/* =========================================================
   CONFIG
   ========================================================= */
const STORAGE_KEY = 'meridian-leaderboard-v1';
const GAME_DURATION = 12 * 60;   // 12 minutes, in seconds
const HINT_PENALTY = 30;         // seconds lost per hint
const MAX_HINTS = 3;
const RING_CIRCUMFERENCE = 2 * Math.PI * 54;

const GEAR_SYMBOLS = ['☀', '☾', '★', '⚙'];
const GEAR_NAMES = ['zon', 'maan', 'ster', 'tandwiel'];

const BELL_FREQS = [392.0, 329.63, 523.25, 261.63]; // G4, E4, C5, C4
const BELL_SEQUENCE_LENGTH = 5;

const RIDDLE_ANSWERS = ['tijd', 'de tijd'];

const HINTS = {
  clock: 'Achturige telling betekent: reken gewoon in het normale 24-uursformaat. "Elf uur en achtenveertig minuten in de avond" is 23:48.',
  gear: 'Klik op een tandwiel om het te laten doorschakelen naar het volgende teken. De volgorde in de gravure is van links naar rechts.',
  bell: 'Speel het klokkenspel zo vaak af als je wilt — het kost geen tijd. Let goed op welke bel als eerste oplicht.',
  riddle: 'Denk aan iets dat verstrijkt, dat je kan verspillen, en dat nooit stilstaat — ook niet als jij stilstaat.',
};

/* =========================================================
   STATE
   ========================================================= */
const state = {
  timeLeft: GAME_DURATION,
  timerId: null,
  running: false,
  hintsLeft: MAX_HINTS,
  digits: { clock: 0, gear: 0, bell: 0, riddle: 0 },
  solved: { clock: false, gear: false, bell: false, riddle: false },
  clockValue: { hour: 0, minute: 0 },
  clockTarget: { hour: 23, minute: 48 },
  gearTarget: [],
  gearCurrent: [0, 0, 0],
  bellSequence: [],
  bellPlayerStep: 0,
  bellBusy: false,
  audioCtx: null,
};

/* =========================================================
   DOM SHORTCUTS
   ========================================================= */
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const el = {
  screens: $$('.screen'),
  btnStart: $('#btn-start'),
  hudTime: $('#hud-time'),
  hudClock: $('#hud-clock'),
  hudProgress: $('#hud-clock__progress'),
  btnHint: $('#btn-hint'),
  hintCount: $('#hint-count'),
  toast: $('#toast'),

  clockHour: $('#clock-hour'),
  clockMinute: $('#clock-minute'),
  btnClockCheck: $('#btn-clock-check'),
  feedbackClock: $('#feedback-clock'),

  gearClue: $('#gear-clue'),
  gears: $('#gears'),
  btnGearCheck: $('#btn-gear-check'),
  feedbackGear: $('#feedback-gear'),

  btnBellPlay: $('#btn-bell-play'),
  bells: $$('.bell'),
  feedbackBell: $('#feedback-bell'),

  formRiddle: $('#form-riddle'),
  riddleInput: $('#riddle-input'),
  feedbackRiddle: $('#feedback-riddle'),

  formGate: $('#form-gate'),
  feedbackGate: $('#feedback-gate'),

  winTime: $('#win-time'),
  formScore: $('#form-score'),
  playerName: $('#player-name'),
  btnRestartWin: $('#btn-restart-win'),
  btnRestartLose: $('#btn-restart-lose'),
};

/* =========================================================
   UTILITIES
   ========================================================= */
const randInt = (max) => Math.floor(Math.random() * max);

const pad2 = (n) => String(n).padStart(2, '0');

const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
};

const showScreen = (id) => {
  el.screens.forEach((screen) => screen.classList.toggle('active', screen.id === id));
};

const showToast = (message, duration = 2600) => {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  window.setTimeout(() => el.toast.classList.remove('show'), duration);
};

const flashFeedback = (node, message, isOk) => {
  node.textContent = message;
  node.classList.remove('ok', 'err');
  node.classList.add(isOk ? 'ok' : 'err');
};

/* =========================================================
   LEADERBOARD (localStorage)
   ========================================================= */
const loadLeaderboard = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
};

const saveLeaderboardEntry = (name, seconds) => {
  const list = loadLeaderboard();
  list.push({ name, seconds, date: new Date().toISOString().slice(0, 10) });
  list.sort((a, b) => a.seconds - b.seconds);
  const trimmed = list.slice(0, 10);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return trimmed;
};

const renderLeaderboard = () => {
  const list = loadLeaderboard();
  const targets = ['#leaderboard-intro', '#leaderboard-win', '#leaderboard-lose'];
  targets.forEach((selector) => {
    const node = $(selector);
    if (!node) return;
    node.innerHTML = '';
    if (list.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'leaderboard-empty';
      empty.textContent = 'Nog niemand is ontsnapt aan de kloktoren…';
      node.appendChild(empty);
      return;
    }
    list.forEach((entry, index) => {
      const li = document.createElement('li');
      const left = document.createElement('span');
      left.textContent = `${index + 1}. ${entry.name}`;
      const right = document.createElement('span');
      right.textContent = formatTime(entry.seconds);
      li.appendChild(left);
      li.appendChild(right);
      node.appendChild(li);
    });
  });
};

/* =========================================================
   TIMER
   ========================================================= */
const updateHudRing = () => {
  const ratio = state.timeLeft / GAME_DURATION;
  const offset = RING_CIRCUMFERENCE * (1 - ratio);
  el.hudProgress.style.strokeDashoffset = String(offset);
  el.hudTime.textContent = formatTime(Math.max(0, state.timeLeft));
  el.hudClock.classList.toggle('warning', state.timeLeft <= 60 && state.timeLeft > 0);
};

const tick = () => {
  state.timeLeft -= 1;
  updateHudRing();
  if (state.timeLeft <= 0) {
    endGame(false);
  }
};

const startTimer = () => {
  stopTimer();
  state.timerId = window.setInterval(tick, 1000);
};

const stopTimer = () => {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
};

const applyHintPenalty = () => {
  state.timeLeft = Math.max(0, state.timeLeft - HINT_PENALTY);
  updateHudRing();
  if (state.timeLeft === 0) endGame(false);
};

/* =========================================================
   AUDIO (Web Audio API — bells)
   ========================================================= */
const getAudioCtx = () => {
  if (!state.audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioContextClass();
  }
  return state.audioCtx;
};

const playTone = (frequency, durationMs = 450) => {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000 + 0.05);
  } catch (err) {
    /* audio unavailable — puzzle still works visually */
  }
};

/* =========================================================
   STAGE NAVIGATION
   ========================================================= */
const STAGE_ORDER = ['clock', 'gear', 'bell', 'riddle', 'gate'];

const goToStage = (stageName) => {
  $$('.stage').forEach((stage) => {
    stage.classList.toggle('active', stage.dataset.stage === stageName);
  });
};

const markSealSolved = (key) => {
  const seal = $(`.seal[data-seal="${key}"]`);
  seal.classList.add('solved');
  $('.seal__digit', seal).textContent = String(state.digits[key]);
};

const advanceAfterSolve = (key) => {
  state.solved[key] = true;
  markSealSolved(key);
  showToast(`Zegel gebroken. Een cijfer valt op de grond: "${state.digits[key]}".`);
  const currentIndex = STAGE_ORDER.indexOf(key);
  const nextStage = STAGE_ORDER[currentIndex + 1];
  window.setTimeout(() => {
    if (nextStage) goToStage(nextStage);
  }, 900);
};

/* =========================================================
   PUZZLE 1 — CLOCK
   ========================================================= */
const renderClockValue = () => {
  el.clockHour.textContent = pad2(state.clockValue.hour);
  el.clockMinute.textContent = pad2(state.clockValue.minute);
};

const adjustClock = (unit, dir) => {
  if (unit === 'hour') {
    state.clockValue.hour = (state.clockValue.hour + dir + 24) % 24;
  } else {
    state.clockValue.minute = (state.clockValue.minute + dir + 60) % 60;
  }
  renderClockValue();
};

const checkClock = () => {
  const correct = state.clockValue.hour === state.clockTarget.hour &&
                   state.clockValue.minute === state.clockTarget.minute;
  if (correct) {
    flashFeedback(el.feedbackClock, 'De wijzers klikken vast. Het zegel breekt.', true);
    advanceAfterSolve('clock');
  } else {
    flashFeedback(el.feedbackClock, 'De wijzers weigeren te bewegen. Reken opnieuw.', false);
  }
};

/* =========================================================
   PUZZLE 2 — GEARS
   ========================================================= */
const buildGearClue = () => {
  const names = state.gearTarget.map((i) => GEAR_NAMES[i]);
  el.gearClue.textContent =
    `Op de wand staat gegraveerd: "Zet de wijzers op ${names[0]}, ${names[1]} en ${names[2]}."`;
};

const renderGears = () => {
  el.gears.innerHTML = '';
  state.gearCurrent.forEach((value, index) => {
    const gear = document.createElement('button');
    gear.type = 'button';
    gear.className = 'gear';
    gear.dataset.index = String(index);
    gear.textContent = GEAR_SYMBOLS[value];
    gear.style.transform = `rotate(${value * 90}deg)`;
    gear.addEventListener('click', () => rotateGear(index));
    el.gears.appendChild(gear);
  });
};

const rotateGear = (index) => {
  state.gearCurrent[index] = (state.gearCurrent[index] + 1) % GEAR_SYMBOLS.length;
  renderGears();
};

const checkGears = () => {
  const correct = state.gearCurrent.every((value, index) => value === state.gearTarget[index]);
  if (correct) {
    flashFeedback(el.feedbackGear, 'De tandwielen grijpen in elkaar. Het zegel breekt.', true);
    advanceAfterSolve('gear');
  } else {
    flashFeedback(el.feedbackGear, 'De tandwielen klemmen vast. Dit is niet de juiste stand.', false);
  }
};

/* =========================================================
   PUZZLE 3 — BELLS
   ========================================================= */
const buildBellSequence = () => {
  state.bellSequence = Array.from({ length: BELL_SEQUENCE_LENGTH }, () => randInt(4));
  state.bellPlayerStep = 0;
};

const litBell = (index, on) => {
  el.bells[index].classList.toggle('lit', on);
};

const playBellSequence = () => {
  if (state.bellBusy) return;
  state.bellBusy = true;
  el.btnBellPlay.disabled = true;
  state.bellPlayerStep = 0;
  flashFeedback(el.feedbackBell, 'Luister goed…', true);

  state.bellSequence.forEach((bellIndex, step) => {
    window.setTimeout(() => {
      litBell(bellIndex, true);
      playTone(BELL_FREQS[bellIndex]);
      window.setTimeout(() => litBell(bellIndex, false), 380);
      if (step === state.bellSequence.length - 1) {
        window.setTimeout(() => {
          state.bellBusy = false;
          el.btnBellPlay.disabled = false;
          flashFeedback(el.feedbackBell, 'Speel de volgorde nu na.', true);
        }, 500);
      }
    }, step * 650);
  });
};

const handleBellClick = (bellIndex) => {
  if (state.bellBusy || state.solved.bell) return;
  litBell(bellIndex, true);
  playTone(BELL_FREQS[bellIndex]);
  window.setTimeout(() => litBell(bellIndex, false), 200);

  const expected = state.bellSequence[state.bellPlayerStep];
  if (bellIndex === expected) {
    state.bellPlayerStep += 1;
    if (state.bellPlayerStep === state.bellSequence.length) {
      flashFeedback(el.feedbackBell, 'De klokken weerklinken in harmonie. Het zegel breekt.', true);
      advanceAfterSolve('bell');
    }
  } else {
    flashFeedback(el.feedbackBell, 'Een misklank. Probeer de volgorde opnieuw te beluisteren.', false);
    state.bellPlayerStep = 0;
  }
};

/* =========================================================
   PUZZLE 4 — RIDDLE
   ========================================================= */
const checkRiddle = (event) => {
  event.preventDefault();
  const answer = el.riddleInput.value.trim().toLowerCase();
  if (RIDDLE_ANSWERS.includes(answer)) {
    flashFeedback(el.feedbackRiddle, 'De klokkenmaker knikt tevreden. Het zegel breekt.', true);
    advanceAfterSolve('riddle');
  } else {
    flashFeedback(el.feedbackRiddle, 'De klokkenmaker schudt het hoofd. Denk opnieuw na.', false);
  }
};

/* =========================================================
   FINAL GATE
   ========================================================= */
const checkGate = (event) => {
  event.preventDefault();
  const inputs = $$('input[data-gate]', el.formGate);
  const correct = inputs.every((input) => {
    const key = input.dataset.gate;
    return Number(input.value) === state.digits[key];
  });
  if (correct) {
    flashFeedback(el.feedbackGate, 'De poort kraakt open…', true);
    window.setTimeout(() => endGame(true), 700);
  } else {
    flashFeedback(el.feedbackGate, 'De poort blijft roerloos. Controleer de cijfers van elk zegel.', false);
    inputs.forEach((input) => { input.value = ''; });
    inputs[0].focus();
  }
};

/* =========================================================
   HINTS
   ========================================================= */
const currentActiveStageName = () => {
  const activeStage = $('.stage.active');
  return activeStage ? activeStage.dataset.stage : null;
};

const useHint = () => {
  if (state.hintsLeft <= 0 || !state.running) return;
  const stageName = currentActiveStageName();
  if (!stageName || stageName === 'gate' || !HINTS[stageName]) {
    showToast('Voor de poort is geen hint meer nodig — combineer de vier cijfers.');
    return;
  }
  state.hintsLeft -= 1;
  el.hintCount.textContent = `(${state.hintsLeft})`;
  el.btnHint.disabled = state.hintsLeft <= 0;
  applyHintPenalty();
  showToast(`Hint: ${HINTS[stageName]} (−${HINT_PENALTY}s)`, 5000);
};

/* =========================================================
   GAME LIFECYCLE
   ========================================================= */
const resetPuzzleState = () => {
  state.digits = {
    clock: randInt(10),
    gear: randInt(10),
    bell: randInt(10),
    riddle: randInt(10),
  };
  state.solved = { clock: false, gear: false, bell: false, riddle: false };

  state.clockValue = { hour: 0, minute: 0 };
  renderClockValue();
  el.feedbackClock.textContent = '';

  state.gearTarget = [randInt(4), randInt(4), randInt(4)];
  state.gearCurrent = [0, 0, 0];
  buildGearClue();
  renderGears();
  el.feedbackGear.textContent = '';

  buildBellSequence();
  el.feedbackBell.textContent = '';

  el.riddleInput.value = '';
  el.feedbackRiddle.textContent = '';

  $$('input[data-gate]', el.formGate).forEach((input) => { input.value = ''; });
  el.feedbackGate.textContent = '';

  $$('.seal').forEach((seal) => {
    seal.classList.remove('solved');
    $('.seal__digit', seal).textContent = '?';
  });

  state.hintsLeft = MAX_HINTS;
  el.hintCount.textContent = `(${MAX_HINTS})`;
  el.btnHint.disabled = false;

  goToStage('clock');
};

const startGame = () => {
  resetPuzzleState();
  state.timeLeft = GAME_DURATION;
  state.running = true;
  updateHudRing();
  showScreen('screen-game');
  startTimer();
};

const endGame = (won) => {
  if (!state.running) return;
  state.running = false;
  stopTimer();

  if (won) {
    const elapsed = GAME_DURATION - state.timeLeft;
    el.winTime.textContent = formatTime(elapsed);
    el.formScore.dataset.seconds = String(elapsed);
    showScreen('screen-win');
  } else {
    showScreen('screen-lose');
  }
  renderLeaderboard();
};

const restartGame = () => {
  el.formScore.reset();
  showScreen('screen-intro');
  renderLeaderboard();
};

/* =========================================================
   EVENT WIRING
   ========================================================= */
const wireEvents = () => {
  el.btnStart.addEventListener('click', startGame);
  el.btnHint.addEventListener('click', useHint);

  $$('.stepper__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      adjustClock(btn.dataset.clock, Number(btn.dataset.dir));
    });
  });
  el.btnClockCheck.addEventListener('click', checkClock);

  el.btnGearCheck.addEventListener('click', checkGears);

  el.btnBellPlay.addEventListener('click', playBellSequence);
  el.bells.forEach((bell) => {
    bell.addEventListener('click', () => handleBellClick(Number(bell.dataset.bell)));
  });

  el.formRiddle.addEventListener('submit', checkRiddle);
  el.formGate.addEventListener('submit', checkGate);

  $$('input[data-gate]', el.formGate).forEach((input, idx, all) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (input.value && all[idx + 1]) all[idx + 1].focus();
    });
  });

  el.formScore.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = el.playerName.value.trim() || 'Naamloze ontsnapte';
    const seconds = Number(el.formScore.dataset.seconds || 0);
    saveLeaderboardEntry(name, seconds);
    renderLeaderboard();
    el.playerName.value = '';
    showToast('Vastgelegd in het register van ontsnapten.');
  });

  el.btnRestartWin.addEventListener('click', restartGame);
  el.btnRestartLose.addEventListener('click', restartGame);
};

/* =========================================================
   INIT
   ========================================================= */
const init = () => {
  wireEvents();
  renderLeaderboard();
  renderClockValue();
};

document.addEventListener('DOMContentLoaded', init);
