(function () {
  "use strict";

  const BLOCKS = ["alongamento", "tecnica", "wod"];
  const BLOCK_LABELS = {
    alongamento: "Alongamento",
    tecnica: "Técnica",
    wod: "WOD",
  };

  const MODES = [
    { value: "sequential", label: "Sequencial" },
    { value: "emom", label: "EMOM" },
    { value: "tabata", label: "Tabata" },
    { value: "amrap", label: "AMRAP" },
    { value: "fortime", label: "For Time" },
  ];

  const SEGMENT_COUNT = 60;

  const state = {
    blocks: {},
    restBetweenBlocks: 60,
    layoutRatio: 70,
    soundEnabled: true,
    prepCountdown: true,
    paused: false,
    segments: [],
    amrapRounds: 0,
    wakeLock: null,
    lastBeepSec: -1,
    halfTimeAnnounced: false,
    tenSecAnnounced: false,
  };

  let audioCtx = null;
  let audioUnlocked = false;
  let voicesReady = false;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function defaultBlock() {
    return {
      mode: "sequential",
      workSeconds: 60,
      restSeconds: 15,
      intervalSeconds: 60,
      totalMinutes: 12,
      timeCapMinutes: 0,
      tabataRounds: 8,
      exercises: [{ name: "", reps: "" }],
    };
  }

  function init() {
    BLOCKS.forEach((block) => {
      state.blocks[block] = defaultBlock();
      renderBlockConfig(block);
      renderExercises(block);
    });

    loadPreferences();
    buildProgressRing();
    applyLayoutRatio(state.layoutRatio);
    $("#sound-enabled").checked = state.soundEnabled;
    $("#prep-countdown").checked = state.prepCountdown;
    $("#rest-between-blocks").value = state.restBetweenBlocks;
    bindEvents();
  }

  function loadPreferences() {
    try {
      const saved = sessionStorage.getItem("wod-prefs");
      if (!saved) return;
      const prefs = JSON.parse(saved);
      if (prefs.layoutRatio) state.layoutRatio = prefs.layoutRatio;
      if (prefs.soundEnabled !== undefined) state.soundEnabled = prefs.soundEnabled;
      if (prefs.prepCountdown !== undefined) state.prepCountdown = prefs.prepCountdown;
      if (prefs.restBetweenBlocks !== undefined) state.restBetweenBlocks = prefs.restBetweenBlocks;
    } catch (_) { /* ignore */ }
  }

  function savePreferences() {
    sessionStorage.setItem(
      "wod-prefs",
      JSON.stringify({
        layoutRatio: state.layoutRatio,
        soundEnabled: state.soundEnabled,
        prepCountdown: state.prepCountdown,
        restBetweenBlocks: state.restBetweenBlocks,
      })
    );
  }

  function applyLayoutRatio(ratio) {
    state.layoutRatio = ratio;
    document.documentElement.style.setProperty("--clock-col", String(ratio));
    const slider = $("#layout-ratio");
    const label = $("#layout-ratio-label");
    if (slider) slider.value = ratio;
    if (label) label.textContent = `${ratio}%`;
    $$(".layout-preset").forEach((btn) => {
      btn.classList.toggle("active", +btn.dataset.ratio === ratio);
    });
    savePreferences();
  }

  function openSettings() {
    $("#settings-menu").classList.remove("hidden");
    syncSettingsUI();
  }

  function closeSettings() {
    $("#settings-menu").classList.add("hidden");
  }

  function syncSettingsUI() {
    $("#sound-enabled").checked = state.soundEnabled;
    $("#prep-countdown").checked = state.prepCountdown;
    applyLayoutRatio(state.layoutRatio);
  }

  function renderBlockConfig(block) {
    const container = $(`#config-${block}`);
    const cfg = state.blocks[block];

    container.innerHTML = `
      <label>
        Modo
        <select data-block="${block}" data-field="mode">
          ${MODES.map(
            (m) =>
              `<option value="${m.value}" ${cfg.mode === m.value ? "selected" : ""}>${m.label}</option>`
          ).join("")}
        </select>
      </label>
      <label class="field-work" data-block="${block}">
        Trabalho (seg)
        <input type="number" min="5" max="600" value="${cfg.workSeconds}" data-block="${block}" data-field="workSeconds">
      </label>
      <label class="field-rest" data-block="${block}">
        Descanso (seg)
        <input type="number" min="0" max="300" value="${cfg.restSeconds}" data-block="${block}" data-field="restSeconds">
      </label>
      <label class="field-interval" data-block="${block}">
        Intervalo EMOM (seg)
        <input type="number" min="10" max="300" value="${cfg.intervalSeconds}" data-block="${block}" data-field="intervalSeconds">
      </label>
      <label class="field-total" data-block="${block}">
        Total EMOM (min)
        <input type="number" min="1" max="60" value="${cfg.totalMinutes}" data-block="${block}" data-field="totalMinutes">
      </label>
      <label class="field-cap" data-block="${block}">
        Time cap (min, 0 = sem limite)
        <input type="number" min="0" max="60" value="${cfg.timeCapMinutes}" data-block="${block}" data-field="timeCapMinutes">
      </label>
      <label class="field-tabata" data-block="${block}">
        Rounds Tabata
        <input type="number" min="1" max="30" value="${cfg.tabataRounds}" data-block="${block}" data-field="tabataRounds">
      </label>
    `;

    updateConfigVisibility(block);
  }

  function updateConfigVisibility(block) {
    const mode = state.blocks[block].mode;
    const panel = $(`.setup-panel[data-block="${block}"]`);

    panel.querySelectorAll(".field-work").forEach((el) => {
      el.style.display = mode === "sequential" ? "" : "none";
    });
    panel.querySelectorAll(".field-rest").forEach((el) => {
      el.style.display = mode === "sequential" ? "" : "none";
    });
    panel.querySelectorAll(".field-interval").forEach((el) => {
      el.style.display = mode === "emom" ? "" : "none";
    });
    panel.querySelectorAll(".field-total").forEach((el) => {
      el.style.display = mode === "emom" ? "" : "none";
    });
    panel.querySelectorAll(".field-cap").forEach((el) => {
      el.style.display = mode === "amrap" || mode === "fortime" ? "" : "none";
    });
    panel.querySelectorAll(".field-tabata").forEach((el) => {
      el.style.display = mode === "tabata" ? "" : "none";
    });
  }

  function getAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    return audioCtx;
  }

  /**
   * Deve rodar de forma síncrona dentro do clique/toque do usuário.
   * Safari/iOS perde permissão de áudio após await no handler.
   */
  function unlockAudioInGesture() {
    if (!state.soundEnabled) return false;

    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (_) { /* ignore */ }

    const el = $("#audio-unlock");
    if (el) {
      el.volume = 0.01;
      el.play().catch(() => {});
    }

    audioUnlocked = true;
    preloadVoices();
    return true;
  }

  function ensureAudioReady() {
    if (!state.soundEnabled) return null;
    const ctx = getAudioContext();
    if (!ctx) return null;
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    return ctx;
  }

  function preloadVoices() {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) {
        resolve([]);
        return;
      }

      const pick = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length) {
          voicesReady = true;
          resolve(voices);
          return true;
        }
        return false;
      };

      if (pick()) return;

      const onVoices = () => {
        if (pick()) {
          speechSynthesis.removeEventListener("voiceschanged", onVoices);
        }
      };
      speechSynthesis.addEventListener("voiceschanged", onVoices);

      const boot = new SpeechSynthesisUtterance(" ");
      boot.volume = 0;
      speechSynthesis.speak(boot);

      setTimeout(() => {
        pick();
        resolve(speechSynthesis.getVoices());
      }, 250);
    });
  }

  function playTone({ freq, duration, volume = 0.3, type = "sine", freqEnd, delay = 0 }) {
    const ctx = ensureAudioReady();
    if (!ctx) return;

    try {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + duration);
      }
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    } catch (_) { /* ignore */ }
  }

  /** Apito de início — tom ascendente (assobio curto) */
  function whistleStart() {
    if (!state.soundEnabled) return;
    playTone({ freq: 1400, freqEnd: 3200, duration: 0.32, volume: 0.38, type: "sine" });
    playTone({ freq: 2200, duration: 0.12, volume: 0.22, type: "triangle", delay: 0.28 });
  }

  /** Apito de término — dois tons descendentes (som diferente do início) */
  function whistleEnd() {
    if (!state.soundEnabled) return;
    playTone({ freq: 2600, freqEnd: 700, duration: 0.28, volume: 0.4, type: "square", delay: 0 });
    playTone({ freq: 2000, freqEnd: 500, duration: 0.35, volume: 0.38, type: "square", delay: 0.32 });
  }

  function beepTick() {
    playTone({ freq: 880, duration: 0.08, volume: 0.18, type: "sine" });
  }

  function speak(text) {
    if (!state.soundEnabled || !("speechSynthesis" in window)) return;

    window.setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.92;
      utterance.volume = 1;
      const voices = speechSynthesis.getVoices();
      const en = voices.find((v) => v.lang.startsWith("en-US"))
        || voices.find((v) => v.lang.startsWith("en"));
      if (en) utterance.voice = en;
      speechSynthesis.speak(utterance);
    }, 50);
  }

  function testAudio() {
    state.soundEnabled = true;
    $("#sound-enabled").checked = true;
    savePreferences();

    if (!unlockAudioInGesture()) {
      alert("Não foi possível ativar o áudio. Verifique se o iPad não está no modo silencioso.");
      return;
    }

    whistleStart();
    window.setTimeout(() => speak("half time"), 500);
    window.setTimeout(() => speak("10 seconds"), 1800);
    window.setTimeout(() => whistleEnd(), 3200);
  }

  function checkPhaseAnnouncements(secLeft, phaseTotal) {
    if (phaseTotal < 15) return;

    const halfMark = Math.floor(phaseTotal / 2);
    if (halfMark > 10 && !state.halfTimeAnnounced && secLeft === halfMark) {
      state.halfTimeAnnounced = true;
      speak("half time");
    }

    if (!state.tenSecAnnounced && secLeft === 10) {
      state.tenSecAnnounced = true;
      speak("10 seconds");
    }
  }

  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      state.wakeLock = await navigator.wakeLock.request("screen");
    } catch (_) { /* ignore */ }
  }

  function releaseWakeLock() {
    state.wakeLock?.release();
    state.wakeLock = null;
  }

  function renderExercises(block) {
    const container = $(`#exercises-${block}`);
    const exercises = state.blocks[block].exercises;

    container.innerHTML = exercises
      .map(
        (ex, i) => `
      <div class="exercise-row" data-block="${block}" data-index="${i}">
        <input type="text" placeholder="Exercício" value="${escapeHtml(ex.name)}" data-block="${block}" data-index="${i}" data-field="name">
        <input type="text" placeholder="Reps" value="${escapeHtml(ex.reps)}" data-block="${block}" data-index="${i}" data-field="reps">
        <button type="button" class="btn-remove" data-block="${block}" data-index="${i}" aria-label="Remover">×</button>
      </div>`
      )
      .join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function buildProgressRing() {
    const g = $("#progress-segments");
    const cx = 100;
    const cy = 100;
    const outerR = 92;
    const innerR = 78;
    const segW = 5;
    const segH = outerR - innerR;

    g.innerHTML = "";
    state.segments = [];

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const angle = (i / SEGMENT_COUNT) * 360 - 90;
      const rad = (angle * Math.PI) / 180;
      const midR = (outerR + innerR) / 2;
      const x = cx + midR * Math.cos(rad) - segW / 2;
      const y = cy + midR * Math.sin(rad) - segH / 2;

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", x);
      rect.setAttribute("y", y);
      rect.setAttribute("width", segW);
      rect.setAttribute("height", segH);
      rect.setAttribute("rx", 2);
      rect.setAttribute("transform", `rotate(${angle + 90} ${x + segW / 2} ${y + segH / 2})`);
      rect.classList.add("segment");
      g.appendChild(rect);
      state.segments.push(rect);
    }
  }

  function updateProgressRing(remaining, total, isRest) {
    const ring = $(".progress-ring");
    ring.classList.toggle("rest", isRest);

    const elapsed = Math.max(0, total - remaining);
    const activeCount = total > 0 ? Math.floor((elapsed / total) * SEGMENT_COUNT) : 0;

    state.segments.forEach((seg, i) => {
      seg.classList.toggle("active", i < activeCount);
    });
  }

  function bindEvents() {
    $$(".block-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const block = tab.dataset.block;
        $$(".block-tab").forEach((t) => {
          t.classList.toggle("active", t === tab);
          t.setAttribute("aria-selected", t === tab ? "true" : "false");
        });
        $$(".setup-panel").forEach((p) => {
          p.classList.toggle("active", p.dataset.block === block);
        });
      });
    });

    document.addEventListener("change", (e) => {
      const block = e.target.dataset?.block;
      const field = e.target.dataset?.field;
      if (!block || !field) return;

      if (field === "mode") {
        state.blocks[block].mode = e.target.value;
        updateConfigVisibility(block);
        return;
      }

      const index = e.target.dataset.index;
      if (index !== undefined) {
        state.blocks[block].exercises[+index][field] = e.target.value;
        return;
      }

      state.blocks[block][field] = +e.target.value || 0;
    });

    document.addEventListener("input", (e) => {
      const block = e.target.dataset?.block;
      const field = e.target.dataset?.field;
      const index = e.target.dataset?.index;
      if (!block || !field || index === undefined) return;
      state.blocks[block].exercises[+index][field] = e.target.value;
    });

    $$(".btn-add").forEach((btn) => {
      btn.addEventListener("click", () => {
        const block = btn.dataset.block;
        state.blocks[block].exercises.push({ name: "", reps: "" });
        renderExercises(block);
      });
    });

    $("#rest-between-blocks").addEventListener("change", (e) => {
      state.restBetweenBlocks = +e.target.value || 0;
      savePreferences();
    });

    $("#layout-ratio")?.addEventListener("input", (e) => {
      applyLayoutRatio(+e.target.value);
    });

    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("layout-preset")) {
        applyLayoutRatio(+e.target.dataset.ratio);
        return;
      }
      if (!e.target.classList.contains("btn-remove")) return;
      const block = e.target.dataset.block;
      const index = +e.target.dataset.index;
      if (state.blocks[block].exercises.length <= 1) return;
      state.blocks[block].exercises.splice(index, 1);
      renderExercises(block);
    });

    $("#sound-enabled")?.addEventListener("change", (e) => {
      state.soundEnabled = e.target.checked;
      savePreferences();
      if (state.soundEnabled) unlockAudioInGesture();
    });

    $("#prep-countdown")?.addEventListener("change", (e) => {
      state.prepCountdown = e.target.checked;
      savePreferences();
    });

    $("#btn-settings-setup")?.addEventListener("click", openSettings);
    $("#btn-settings-timer")?.addEventListener("click", openSettings);
    $("#btn-settings-close")?.addEventListener("click", closeSettings);
    $("#settings-backdrop")?.addEventListener("click", closeSettings);
    $("#btn-test-audio")?.addEventListener("click", testAudio);
    $("#btn-fullscreen")?.addEventListener("click", toggleFullscreen);
    $("#btn-round-plus")?.addEventListener("click", () => updateAmrapRounds(1));
    $("#btn-round-minus")?.addEventListener("click", () => updateAmrapRounds(-1));

    $("#btn-start").addEventListener("click", () => {
      if (state.soundEnabled) unlockAudioInGesture();
      startWorkout();
    });

    ["touchstart", "pointerdown"].forEach((evt) => {
      document.addEventListener(
        evt,
        () => {
          if (
            state.soundEnabled &&
            !audioUnlocked &&
            $("#timer-screen").classList.contains("active")
          ) {
            unlockAudioInGesture();
          }
        },
        { passive: true }
      );
    });
    $("#btn-pause").addEventListener("click", togglePause);
    $("#btn-skip").addEventListener("click", skipPhase);
    $("#btn-stop").addEventListener("click", stopWorkout);
    $("#btn-restart").addEventListener("click", () => showScreen("setup-screen"));

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && $("#timer-screen").classList.contains("active")) {
        requestWakeLock();
      }
    });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  function updateAmrapRounds(delta) {
    state.amrapRounds = Math.max(0, state.amrapRounds + delta);
    $("#round-count").textContent = state.amrapRounds;
  }

  function showScreen(id) {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    $(`#${id}`).classList.add("active");
  }

  function getActiveBlocks() {
    return BLOCKS.filter((b) => {
      const ex = state.blocks[b].exercises.filter((e) => e.name.trim());
      return ex.length > 0;
    }).map((b) => ({
      key: b,
      label: BLOCK_LABELS[b],
      config: { ...state.blocks[b], exercises: state.blocks[b].exercises.filter((e) => e.name.trim()) },
    }));
  }

  function buildTimeline() {
    const active = getActiveBlocks();
    const timeline = [];

    active.forEach((block, blockIndex) => {
      const { config } = block;
      const exercises = config.exercises;

      if (config.mode === "sequential") {
        exercises.forEach((ex, i) => {
          timeline.push({
            type: "work",
            blockKey: block.key,
            blockLabel: block.label,
            mode: config.mode,
            exercise: ex,
            exerciseIndex: i,
            exercises,
            duration: config.workSeconds,
            countdown: true,
          });
          if (config.restSeconds > 0 && i < exercises.length - 1) {
            timeline.push({
              type: "rest",
              blockKey: block.key,
              blockLabel: block.label,
              mode: config.mode,
              duration: config.restSeconds,
              countdown: true,
              label: "Descanso",
            });
          }
        });
      } else if (config.mode === "emom") {
        const totalIntervals = config.totalMinutes;
        for (let m = 0; m < totalIntervals; m++) {
          const exIndex = m % exercises.length;
          timeline.push({
            type: "work",
            blockKey: block.key,
            blockLabel: block.label,
            mode: config.mode,
            exercise: exercises[exIndex],
            exerciseIndex: exIndex,
            exercises,
            interval: m + 1,
            totalIntervals,
            duration: config.intervalSeconds,
            countdown: true,
          });
        }
      } else if (config.mode === "tabata") {
        const ex = exercises[0];
        for (let r = 0; r < config.tabataRounds; r++) {
          timeline.push({
            type: "work",
            blockKey: block.key,
            blockLabel: block.label,
            mode: config.mode,
            exercise: ex,
            exercises,
            round: r + 1,
            totalRounds: config.tabataRounds,
            duration: 20,
            countdown: true,
            label: "Tabata",
          });
          if (r < config.tabataRounds - 1) {
            timeline.push({
              type: "rest",
              blockKey: block.key,
              blockLabel: block.label,
              mode: config.mode,
              exercise: ex,
              exercises,
              round: r + 1,
              totalRounds: config.tabataRounds,
              duration: 10,
              countdown: true,
              label: "Descanso Tabata",
            });
          }
        }
      } else if (config.mode === "amrap" || config.mode === "fortime") {
        const cap = config.timeCapMinutes;
        timeline.push({
          type: "work",
          blockKey: block.key,
          blockLabel: block.label,
          mode: config.mode,
          exercises,
          duration: cap > 0 ? cap * 60 : 0,
          countdown: cap > 0,
          label: config.mode === "amrap" ? "AMRAP" : "For Time",
        });
      }

      if (blockIndex < active.length - 1 && state.restBetweenBlocks > 0) {
        timeline.push({
          type: "rest",
          blockKey: block.key,
          blockLabel: block.label,
          duration: state.restBetweenBlocks,
          countdown: true,
          label: "Descanso entre blocos",
          betweenBlocks: true,
        });
      }
    });

    return timeline;
  }

  let timeline = [];
  let phaseIndex = 0;
  let remaining = 0;
  let phaseTotal = 0;
  let tickInterval = null;
  let lastTick = 0;

  function startWorkout() {
    timeline = buildTimeline();
    if (timeline.length === 0) {
      alert("Adicione pelo menos um exercício em algum bloco.");
      return;
    }

    closeSettings();
    phaseIndex = 0;
    state.paused = false;
    state.amrapRounds = 0;
    state.lastBeepSec = -1;
    state.halfTimeAnnounced = false;
    state.tenSecAnnounced = false;
    $("#round-count").textContent = "0";
    $("#rest-between-blocks").value = state.restBetweenBlocks;
    applyLayoutRatio(state.layoutRatio);

    showScreen("timer-screen");
    requestWakeLock();

    if (state.prepCountdown) {
      runPrepCountdown(() => enterPhase(0, { skipStartWhistle: true }));
    } else {
      enterPhase(0);
    }
  }

  function runPrepCountdown(done) {
    const overlay = $("#prep-overlay");
    const num = $("#prep-number");
    const sequence = ["3", "2", "1", "GO!"];
    let i = 0;

    overlay.classList.remove("hidden");
    num.textContent = sequence[i];
    playTone({ freq: 660, duration: 0.1, volume: 0.15, type: "sine" });

    const step = setInterval(() => {
      i += 1;
      if (i >= sequence.length) {
        clearInterval(step);
        overlay.classList.add("hidden");
        whistleStart();
        done();
        return;
      }
      num.textContent = sequence[i];
      playTone({ freq: 660, duration: 0.1, volume: 0.15, type: "sine" });
    }, 1000);
  }

  function enterPhase(index, opts = {}) {
    phaseIndex = index;
    const phase = timeline[index];
    phaseTotal = phase.duration || 60;
    remaining = phase.countdown ? phaseTotal : 0;
    lastTick = performance.now();
    state.lastBeepSec = -1;
    state.halfTimeAnnounced = false;
    state.tenSecAnnounced = false;

    if (!opts.skipStartWhistle) {
      whistleStart();
    }

    updateTimerUI(phase);
    clearInterval(tickInterval);
    tickInterval = setInterval(tick, 100);
  }

  function tick() {
    if (state.paused) {
      lastTick = performance.now();
      return;
    }

    const now = performance.now();
    const delta = (now - lastTick) / 1000;
    lastTick = now;
    const phase = timeline[phaseIndex];

    if (phase.countdown) {
      remaining -= delta;
      const secLeft = Math.ceil(remaining);

      checkPhaseAnnouncements(secLeft, phaseTotal);

      if (secLeft <= 3 && secLeft > 0 && secLeft !== state.lastBeepSec) {
        state.lastBeepSec = secLeft;
        beepTick();
        $("#clock-display").classList.add("flash");
        setTimeout(() => $("#clock-display").classList.remove("flash"), 1200);
      }
      if (remaining <= 0) {
        remaining = 0;
        updateTimerUI(phase);
        clearInterval(tickInterval);
        whistleEnd();
        const next = phaseIndex + 1;
        setTimeout(() => {
          if (next >= timeline.length) finishWorkout({ skipEndWhistle: true });
          else enterPhase(next);
        }, 450);
        return;
      }
    } else {
      remaining += delta;
    }

    updateTimerUI(phase);
  }

  function updateTimerUI(phase) {
    const isRest = phase.type === "rest";
    const countdown = phase.countdown;

    $("#timer-block-name").textContent = phase.blockLabel;
    $("#timer-phase").textContent = isRest ? (phase.label || "Descanso") : phase.label || "Trabalho";
    $("#timer-phase").classList.toggle("rest", isRest);

    const displaySec = countdown ? Math.ceil(remaining) : Math.floor(remaining);
    const mins = Math.floor(displaySec / 60);
    const secs = displaySec % 60;

    $("#clock-min").textContent = String(mins).padStart(2, "0");
    $("#clock-sec").textContent = String(secs).padStart(2, "0");

    const clock = $("#clock-display");
    clock.classList.toggle("rest", isRest);
    clock.classList.toggle("count-up", !countdown);

    const progressTotal = countdown ? phaseTotal : 60;
    const progressRemaining = countdown ? remaining : remaining % 60;
    updateProgressRing(progressRemaining, progressTotal, isRest);

    const nowPanel = $("#exercise-now-panel");
    const nextPanel = $("#exercise-next-panel");
    const listPanel = $("#exercise-list-panel");
    const amrapPanel = $("#amrap-rounds-panel");

    if (phase.mode === "amrap") {
      amrapPanel.classList.remove("hidden");
    } else {
      amrapPanel.classList.add("hidden");
    }

    if (isRest) {
      nowPanel.classList.remove("hidden");
      nextPanel.classList.remove("hidden");
      listPanel.classList.add("hidden");
      $("#current-exercise").textContent = phase.label || "Descanso";
      $("#current-reps").textContent = "";

      const nextPhase = timeline[phaseIndex + 1];
      if (nextPhase && nextPhase.exercise) {
        $("#next-exercise").textContent = nextPhase.exercise.name;
        $("#next-reps").textContent = nextPhase.exercise.reps ? `${nextPhase.exercise.reps} reps` : "";
      } else if (nextPhase && nextPhase.exercises) {
        $("#next-exercise").textContent = nextPhase.label || BLOCK_LABELS[nextPhase.blockKey];
        $("#next-reps").textContent = `${nextPhase.exercises.length} exercícios`;
      } else {
        $("#next-exercise").textContent = "—";
        $("#next-reps").textContent = "";
      }
    } else if (phase.mode === "emom") {
      nowPanel.classList.remove("hidden");
      nextPanel.classList.remove("hidden");
      listPanel.classList.add("hidden");

      $("#current-exercise").textContent = phase.exercise.name;
      $("#current-reps").textContent = phase.exercise.reps ? `${phase.exercise.reps} reps` : "";

      const nextExIndex = (phase.exerciseIndex + 1) % phase.exercises.length;
      const nextEx = phase.exercises[nextExIndex];
      const isLastInterval = phase.interval === phase.totalIntervals;
      if (isLastInterval) {
        const nextPhase = timeline[phaseIndex + 1];
        if (nextPhase?.exercise) {
          $("#next-exercise").textContent = nextPhase.exercise.name;
          $("#next-reps").textContent = nextPhase.exercise.reps ? `${nextPhase.exercise.reps} reps` : "";
        } else if (nextPhase?.type === "rest") {
          $("#next-exercise").textContent = nextPhase.label || "Descanso";
          $("#next-reps").textContent = "";
        } else {
          $("#next-exercise").textContent = "Fim do bloco";
          $("#next-reps").textContent = "";
        }
      } else {
        $("#next-exercise").textContent = nextEx.name;
        $("#next-reps").textContent = nextEx.reps ? `${nextEx.reps} reps` : "";
      }

      $("#round-info").textContent = `Minuto ${phase.interval} / ${phase.totalIntervals}`;
    } else if (phase.mode === "tabata") {
      nowPanel.classList.remove("hidden");
      nextPanel.classList.add("hidden");
      listPanel.classList.add("hidden");

      $("#current-exercise").textContent = isRest ? "Descanso" : phase.exercise.name;
      $("#current-reps").textContent = isRest ? "" : (phase.exercise.reps ? `${phase.exercise.reps} reps` : "");
      $("#round-info").textContent = `Round ${phase.round} / ${phase.totalRounds} · ${isRest ? "10s" : "20s"}`;
    } else if (phase.mode === "amrap" || phase.mode === "fortime") {
      nowPanel.classList.add("hidden");
      nextPanel.classList.add("hidden");
      listPanel.classList.remove("hidden");

      const list = $("#block-exercise-list");
      list.innerHTML = phase.exercises
        .map(
          (ex, i) => `
        <li>
          <span>${escapeHtml(ex.name)}</span>
          <span class="item-reps">${escapeHtml(ex.reps)}</span>
        </li>`
        )
        .join("");

      const capLabel = phase.countdown
        ? `Time cap: ${Math.floor(phaseTotal / 60)} min`
        : phase.mode === "amrap"
          ? "AMRAP — sem limite"
          : "For Time — sem limite";
      $("#round-info").textContent = capLabel;
    } else {
      nowPanel.classList.remove("hidden");
      nextPanel.classList.remove("hidden");
      listPanel.classList.add("hidden");

      $("#current-exercise").textContent = phase.exercise.name;
      $("#current-reps").textContent = phase.exercise.reps ? `${phase.exercise.reps} reps` : "";

      const nextPhase = timeline[phaseIndex + 1];
      if (nextPhase?.exercise) {
        $("#next-exercise").textContent = nextPhase.exercise.name;
        $("#next-reps").textContent = nextPhase.exercise.reps ? `${nextPhase.exercise.reps} reps` : "";
      } else if (nextPhase?.type === "rest") {
        $("#next-exercise").textContent = "Descanso";
        $("#next-reps").textContent = `${nextPhase.duration}s`;
      } else {
        $("#next-exercise").textContent = "—";
        $("#next-reps").textContent = "";
      }

      const exNum = phase.exerciseIndex + 1;
      $("#round-info").textContent = `Exercício ${exNum} / ${phase.exercises.length}`;
    }
  }

  function togglePause() {
    state.paused = !state.paused;
    $("#btn-pause").textContent = state.paused ? "Continuar" : "Pausar";
    if (!state.paused) lastTick = performance.now();
  }

  function skipPhase() {
    clearInterval(tickInterval);
    whistleEnd();
    const next = phaseIndex + 1;
    setTimeout(() => {
      if (next >= timeline.length) finishWorkout({ skipEndWhistle: true });
      else enterPhase(next);
    }, 350);
  }

  function stopWorkout() {
    clearInterval(tickInterval);
    releaseWakeLock();
    showScreen("setup-screen");
  }

  function finishWorkout(opts = {}) {
    clearInterval(tickInterval);
    releaseWakeLock();
    if (!opts.skipEndWhistle) whistleEnd();
    const rounds = state.amrapRounds > 0 ? ` Rounds AMRAP: ${state.amrapRounds}.` : "";
    $("#finished-summary").textContent = `Bom treino!${rounds} Configure um novo WOD quando quiser.`;
    showScreen("finished-screen");
  }

  init();
})();
