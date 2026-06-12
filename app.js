(function () {
  "use strict";

  if (typeof WodCore === "undefined") {
    window.addEventListener("DOMContentLoaded", () => {
      alert("Erro: core.js não carregou. Recarregue a página com Cmd+Shift+R.");
    });
    return;
  }

  const BLOCKS = WodCore.BLOCKS;
  const BLOCK_LABELS = WodCore.BLOCK_LABELS;
  const MODES = WodCore.MODES;
  const EXERCISE_VIEWS = WodCore.EXERCISE_VIEWS || [];
  const defaultBlock = WodCore.defaultBlock;
  const defaultBlockEntry = WodCore.defaultBlockEntry || ((cat) => ({ id: `block-${Date.now()}`, category: cat || "wod", ...defaultBlock() }));
  const defaultExercise = WodCore.defaultExercise || (() => ({ name: "", reps: "", weightM: "", weightF: "", restSeconds: "" }));
  const WEIGHT_UNITS = WodCore.WEIGHT_UNITS || [];
  const fetchWorkouts = WodCore.fetchWorkouts;
  let classicTemplates = [];
  const buildTimeline = WodCore.buildTimeline;
  const estimateDuration = WodCore.estimateDuration || (() => 0);
  const formatDuration = WodCore.formatDuration || ((s) => (s > 0 ? `${s}s` : "sem limite"));
  const formatClockTime = WodCore.formatClockTime || ((t) => String(t));
  const serializeConfig = WodCore.serializeConfig;
  const createStateFromConfig = WodCore.createStateFromConfig;

  const SAVED_WODS_KEY = "wod-saved-templates";

  const SEGMENT_COUNT = 60;

  const state = {
    blockList: [],
    restBetweenBlocks: 60,
    weightUnit: "lb",
    layoutRatio: 70,
    soundEnabled: true,
    prepSeconds: 3,
    paused: false,
    segments: [],
    amrapRounds: 0,
    exerciseCursor: 0,
    forTimeElapsed: null,
    wakeLock: null,
    lastBeepSec: -1,
    halfTimeAnnounced: false,
    tenSecAnnounced: false,
  };

  let prepInterval = null;

  let audioCtx = null;
  let audioUnlocked = false;
  let voicesReady = false;

  const PAGE_MODE = document.body.dataset.page || "standalone";
  let displaySync = null;
  let remoteSync = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function getBlock(blockId) {
    return state.blockList.find((b) => b.id === blockId);
  }

  function addBlock(category = "wod") {
    state.blockList.push(defaultBlockEntry(category));
    renderWorkoutList();
    updateWorkoutPreview();
  }

  function removeBlock(blockId) {
    state.blockList = state.blockList.filter((b) => b.id !== blockId);
    renderWorkoutList();
    updateWorkoutPreview();
  }

  async function loadClassicTemplates() {
    if (typeof fetchWorkouts !== "function") return;
    try {
      classicTemplates = await fetchWorkouts();
    } catch (err) {
      console.warn("Não foi possível carregar treinos:", err);
    }
  }

  async function init() {
    state.blockList = [];
    loadPreferences();
    buildProgressRing();
    applyLayoutRatio(state.layoutRatio);
    syncWeightUnitUI();
    const soundEl = $("#sound-enabled");
    if (soundEl) soundEl.checked = state.soundEnabled;
    const prepEl = $("#prep-seconds");
    if (prepEl) prepEl.value = state.prepSeconds;
    const restEl = $("#rest-between-blocks");
    if (restEl) restEl.value = state.restBetweenBlocks;
    await loadClassicTemplates();
    renderTemplateSelectors();
    renderWorkoutList();
    updateWorkoutPreview();
    bindEvents();
  }

  function loadPreferences() {
    try {
      const saved = sessionStorage.getItem("wod-prefs");
      if (!saved) return;
      const prefs = JSON.parse(saved);
      if (prefs.layoutRatio) state.layoutRatio = prefs.layoutRatio;
      if (prefs.soundEnabled !== undefined) state.soundEnabled = prefs.soundEnabled;
      if (prefs.prepSeconds !== undefined) {
        state.prepSeconds = prefs.prepSeconds;
      } else if (prefs.prepCountdown === false) {
        state.prepSeconds = 0;
      }
      if (prefs.restBetweenBlocks !== undefined) state.restBetweenBlocks = prefs.restBetweenBlocks;
      if (prefs.weightUnit) state.weightUnit = prefs.weightUnit;
    } catch (_) { /* ignore */ }
  }

  function savePreferences() {
    sessionStorage.setItem(
      "wod-prefs",
      JSON.stringify({
        layoutRatio: state.layoutRatio,
        soundEnabled: state.soundEnabled,
        prepSeconds: state.prepSeconds,
        restBetweenBlocks: state.restBetweenBlocks,
        weightUnit: state.weightUnit,
      })
    );
  }

  function syncWeightUnitUI() {
    const el = $("#weight-unit-settings");
    if (el) el.value = state.weightUnit;
    document.querySelectorAll(".weight-unit-label").forEach((node) => {
      node.textContent = state.weightUnit;
    });
  }

  function getSavedTemplates() {
    try {
      const raw = localStorage.getItem(SAVED_WODS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveTemplate(name) {
    syncFormToState();
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      alert("Digite um nome para salvar o WOD.");
      return;
    }
    const templates = getSavedTemplates();
    const config = getSerializableConfig();
    const existing = templates.findIndex((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    const entry = {
      id: existing >= 0 ? templates[existing].id : `wod-${Date.now()}`,
      name: trimmed,
      savedAt: Date.now(),
      config,
    };
    if (existing >= 0) templates[existing] = entry;
    else templates.unshift(entry);
    localStorage.setItem(SAVED_WODS_KEY, JSON.stringify(templates.slice(0, 30)));
    renderTemplateSelectors();
    const select = $("#template-select");
    if (select) select.value = entry.id;
  }

  function deleteSavedTemplate(id) {
    const templates = getSavedTemplates().filter((t) => t.id !== id);
    localStorage.setItem(SAVED_WODS_KEY, JSON.stringify(templates));
    renderTemplateSelectors();
  }

  function renderTemplateSelectors() {
    const select = $("#template-select");
    if (!select) return;

    const saved = getSavedTemplates();
    const presetWorkouts = classicTemplates.filter((t) => t.classic);
    const customWorkouts = classicTemplates.filter((t) => !t.classic);
    const groups = [
      { label: "Padrão", items: presetWorkouts },
      ...(customWorkouts.length ? [{ label: "Treinos", items: customWorkouts }] : []),
      { label: "Salvos", items: saved || [] },
    ];

    select.innerHTML = `<option value="">— Carregar WOD —</option>`;
    groups.forEach((group) => {
      if (!group.items?.length) return;
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      group.items.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.classic ? `${t.name} ★` : t.name;
        opt.title = t.description || t.name;
        optgroup.appendChild(opt);
      });
      select.appendChild(optgroup);
    });
  }

  function applyFullConfig(payload) {
    if (!payload) return;
    const merged = createStateFromConfig
      ? createStateFromConfig(payload)
      : { blockList: [], restBetweenBlocks: payload.restBetweenBlocks ?? 60, weightUnit: payload.weightUnit || "lb" };

    state.blockList = merged.blockList || [];
    if (payload.restBetweenBlocks !== undefined) {
      state.restBetweenBlocks = payload.restBetweenBlocks;
      const el = $("#rest-between-blocks");
      if (el) el.value = state.restBetweenBlocks;
    }
    if (payload.weightUnit) {
      state.weightUnit = payload.weightUnit;
      syncWeightUnitUI();
    }
    if (payload.layoutRatio !== undefined) applyLayoutRatio(payload.layoutRatio);
    if (payload.soundEnabled !== undefined) {
      state.soundEnabled = payload.soundEnabled;
      const el = $("#sound-enabled");
      if (el) el.checked = state.soundEnabled;
    }
    if (payload.prepSeconds !== undefined) {
      state.prepSeconds = payload.prepSeconds;
      const el = $("#prep-seconds");
      if (el) el.value = state.prepSeconds;
    }
    savePreferences();
    renderWorkoutList();
    updateWorkoutPreview();
  }

  function loadSelectedTemplate(id) {
    if (!id) return;
    const classic = classicTemplates.find((t) => t.id === id);
    const saved = getSavedTemplates().find((t) => t.id === id);
    const template = classic || saved;
    if (!template) return;
    applyFullConfig(template.config);
    const nameEl = $("#template-name");
    if (nameEl && !classic) nameEl.value = template.name;
  }

  function syncFormToState() {
    document.querySelectorAll(".exercise-item input[data-block-id][data-index][data-field]").forEach((input) => {
      const blockId = input.dataset.blockId;
      const index = +input.dataset.index;
      const field = input.dataset.field;
      const block = getBlock(blockId);
      if (block?.exercises[index]) {
        block.exercises[index][field] = input.value;
      }
    });

    document.querySelectorAll(".panel-config [data-block-id][data-field]").forEach((input) => {
      const blockId = input.dataset.blockId;
      const field = input.dataset.field;
      const block = getBlock(blockId);
      if (!block || field === "mode" || field === "category") return;
      block[field] = +input.value || 0;
    });

    document.querySelectorAll(".panel-config select[data-block-id][data-field]").forEach((select) => {
      const blockId = select.dataset.blockId;
      const field = select.dataset.field;
      const block = getBlock(blockId);
      if (!block) return;
      if (field === "mode") block.mode = select.value;
      if (field === "category") block.category = select.value;
    });

    document.querySelectorAll(".workout-block-toolbar select[data-block-id][data-field='category']").forEach((select) => {
      const block = getBlock(select.dataset.blockId);
      if (block) block.category = select.value;
    });

    const restEl = $("#rest-between-blocks");
    if (restEl) state.restBetweenBlocks = +restEl.value || 0;

    const weightEl = $("#weight-unit-settings");
    if (weightEl) state.weightUnit = weightEl.value;
  }

  function updateWorkoutPreview() {
    const el = $("#workout-preview");
    if (!el) return;
    const seconds = estimateDuration(state);
    const phases = buildTimeline(state);
    if (!phases.length) {
      el.textContent = "Adicione blocos e exercícios (nome ou reps) para ver a duração estimada.";
      return;
    }
    el.textContent = `Duração estimada: ${formatDuration(seconds)} · ${phases.length} fases`;
  }

  function formatWeightLine(ex) {
    const parts = [];
    if (ex.weightM?.trim()) parts.push(`M: ${ex.weightM.trim()}`);
    if (ex.weightF?.trim()) parts.push(`F: ${ex.weightF.trim()}`);
    return parts.join(" · ");
  }

  function formatExerciseDetail(ex) {
    const reps = ex.reps ? `${ex.reps} reps` : "";
    const weights = formatWeightLine(ex);
    if (reps && weights) return `${reps} · ${weights}`;
    return reps || weights || "";
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
    const menu = $("#settings-menu");
    if (!menu) return;
    menu.classList.remove("hidden");
    syncSettingsUI();
  }

  function closeSettings() {
    $("#settings-menu")?.classList.add("hidden");
  }

  function syncSettingsUI() {
    const sound = $("#sound-enabled");
    if (sound) sound.checked = state.soundEnabled;
    const prep = $("#prep-seconds");
    if (prep) prep.value = state.prepSeconds;
    const weightEl = $("#weight-unit-settings");
    if (weightEl) weightEl.value = state.weightUnit;
    if ($("#layout-ratio")) applyLayoutRatio(state.layoutRatio);
  }

  function getSerializableConfig() {
    syncFormToState();
    if (serializeConfig) return serializeConfig(state);
    return {
      blockList: JSON.parse(JSON.stringify(state.blockList)),
      restBetweenBlocks: state.restBetweenBlocks,
      weightUnit: state.weightUnit,
      layoutRatio: state.layoutRatio,
      soundEnabled: state.soundEnabled,
      prepSeconds: state.prepSeconds,
    };
  }

  function applyRemoteConfig(payload) {
    applyFullConfig(payload);
  }

  function broadcastStatus() {
    if (PAGE_MODE !== "display" || !displaySync) return;
    const activeScreen = document.querySelector(".screen.active");
    const phase = timeline[phaseIndex];
    displaySync.send({
      type: "status",
      payload: {
        screen: activeScreen?.id || "pairing-screen",
        paused: state.paused,
        remaining: phase ? Math.ceil(remaining) : 0,
        block: phase?.blockLabel || "",
        label: phase?.label || phase?.exercise?.name || "",
        amrapRounds: state.amrapRounds,
        forTimeElapsed: state.forTimeElapsed,
        mode: phase?.mode || "",
      },
    });
  }

  function renderWorkoutList() {
    const container = $("#workout-list");
    if (!container) return;

    if (!state.blockList.length) {
      container.innerHTML = `<p class="workout-list-empty">Nenhum bloco ainda. Toque em <strong>+ Bloco</strong> para começar.</p>`;
      return;
    }

    container.innerHTML = state.blockList
      .map(
        (block, blockIndex) => `
      <section class="workout-block" data-block-id="${block.id}">
        <div class="workout-block-toolbar">
          <label class="block-type-field">
            <span>Tipo</span>
            <select data-block-id="${block.id}" data-field="category">
              ${BLOCKS.map(
                (cat) =>
                  `<option value="${cat}" ${block.category === cat ? "selected" : ""}>${BLOCK_LABELS[cat]}</option>`
              ).join("")}
            </select>
          </label>
          <span class="workout-block-order">${blockIndex + 1}</span>
          <button type="button" class="btn-remove-block" data-block-id="${block.id}" aria-label="Remover bloco">×</button>
        </div>
        <div class="panel-config" id="config-${block.id}"></div>
        <ol class="exercise-list" id="exercises-${block.id}"></ol>
        <button type="button" class="btn-add btn-add-exercise" data-block-id="${block.id}">+ Exercício</button>
      </section>`
      )
      .join("");

    state.blockList.forEach((block) => {
      renderBlockConfig(block.id);
      renderExercises(block.id);
    });
  }

  function renderBlockConfig(blockId) {
    const container = $(`#config-${blockId}`);
    const cfg = getBlock(blockId);
    if (!container || !cfg) return;

    container.innerHTML = `
      <label>
        Modo
        <select data-block-id="${blockId}" data-field="mode">
          ${MODES.map(
            (m) =>
              `<option value="${m.value}" ${cfg.mode === m.value ? "selected" : ""}>${m.label}</option>`
          ).join("")}
        </select>
      </label>
      <label class="field-work" data-block-id="${blockId}">
        Trabalho (seg)
        <input type="number" min="5" max="600" value="${cfg.workSeconds}" data-block-id="${blockId}" data-field="workSeconds">
      </label>
      <label class="field-rest" data-block-id="${blockId}">
        Descanso padrão (seg)
        <input type="number" min="0" max="300" value="${cfg.restSeconds}" data-block-id="${blockId}" data-field="restSeconds">
      </label>
      <label class="field-interval" data-block-id="${blockId}">
        Intervalo EMOM (seg)
        <input type="number" min="10" max="300" value="${cfg.intervalSeconds}" data-block-id="${blockId}" data-field="intervalSeconds">
      </label>
      <label class="field-total" data-block-id="${blockId}">
        Total EMOM (min)
        <input type="number" min="1" max="60" value="${cfg.totalMinutes}" data-block-id="${blockId}" data-field="totalMinutes">
      </label>
      <label class="field-cap" data-block-id="${blockId}">
        Time cap (min, 0 = sem limite)
        <input type="number" min="0" max="60" value="${cfg.timeCapMinutes}" data-block-id="${blockId}" data-field="timeCapMinutes">
      </label>
      <label class="field-exercise-view" data-block-id="${blockId}">
        Exibição no treino
        <select data-block-id="${blockId}" data-field="exerciseView">
          ${EXERCISE_VIEWS.map(
            (v) =>
              `<option value="${v.value}" ${cfg.exerciseView === v.value ? "selected" : ""}>${v.label}</option>`
          ).join("")}
        </select>
      </label>
      <label class="field-tabata" data-block-id="${blockId}">
        Rounds Tabata
        <input type="number" min="1" max="30" value="${cfg.tabataRounds}" data-block-id="${blockId}" data-field="tabataRounds">
      </label>
    `;

    updateConfigVisibility(blockId);
  }

  function updateConfigVisibility(blockId) {
    const block = getBlock(blockId);
    const panel = $(`.workout-block[data-block-id="${blockId}"]`);
    if (!block || !panel) return;
    const mode = block.mode;

    panel.querySelectorAll(".field-work").forEach((el) => {
      el.style.display = mode === "sequential" ? "" : "none";
    });
    panel.querySelectorAll(".field-rest").forEach((el) => {
      el.style.display = mode === "sequential" ? "" : "none";
    });
    panel.querySelectorAll(".field-rest-exercise").forEach((el) => {
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
    panel.querySelectorAll(".field-exercise-view").forEach((el) => {
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

  function renderExercises(blockId) {
    const container = $(`#exercises-${blockId}`);
    const block = getBlock(blockId);
    if (!container || !block) return;
    const exercises = block.exercises;
    const showRest = block.mode === "sequential";
    const blockEl = $(`.workout-block[data-block-id="${blockId}"]`);

    blockEl?.classList.toggle("workout-block--empty", exercises.length === 0);

    let header = $(`#exercise-header-${blockId}`);
    if (!header && blockEl) {
      header = document.createElement("div");
      header.id = `exercise-header-${blockId}`;
      header.className = "exercise-list-header";
      header.innerHTML =
        "<span></span><span>Exercício</span><span>M</span><span>F</span><span>Reps</span><span>Desc</span><span></span>";
      container.before(header);
    }
    header?.classList.toggle("hidden", exercises.length === 0);
    header?.classList.toggle("exercise-list-header--no-rest", !showRest);

    if (!exercises.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = exercises
      .map(
        (ex, i) => `
      <li class="exercise-item${showRest ? " exercise-item--with-rest" : ""}" data-block-id="${blockId}" data-index="${i}">
        <span class="exercise-item-num">${i + 1}</span>
        <input type="text" class="exercise-item-name" placeholder="Exercício" value="${escapeHtml(ex.name)}" data-block-id="${blockId}" data-index="${i}" data-field="name">
        <input type="text" class="exercise-item-weight" placeholder="M" value="${escapeHtml(ex.weightM || "")}" data-block-id="${blockId}" data-index="${i}" data-field="weightM" title="Peso M" aria-label="Peso M">
        <input type="text" class="exercise-item-weight" placeholder="F" value="${escapeHtml(ex.weightF || "")}" data-block-id="${blockId}" data-index="${i}" data-field="weightF" title="Peso F" aria-label="Peso F">
        <input type="text" class="exercise-item-reps" placeholder="Reps" value="${escapeHtml(ex.reps)}" data-block-id="${blockId}" data-index="${i}" data-field="reps" title="Repetições" aria-label="Repetições">
        <input type="number" class="exercise-item-rest${showRest ? "" : " hidden"}" min="0" max="600" placeholder="Desc" value="${escapeHtml(ex.restSeconds ?? "")}" data-block-id="${blockId}" data-index="${i}" data-field="restSeconds" title="Descanso em segundos" aria-label="Descanso segundos">
        <button type="button" class="btn-remove btn-remove--compact" data-block-id="${blockId}" data-index="${i}" aria-label="Remover exercício ${i + 1}">×</button>
      </li>`
      )
      .join("");
  }

  function findUpcomingExercises(fromIndex, count = 2) {
    const found = [];
    for (let i = fromIndex; i < timeline.length && found.length < count; i++) {
      const p = timeline[i];
      if (p.type === "work" && p.exercise) {
        found.push(p.exercise);
      } else if (p.type === "work" && p.exercises?.length && (p.mode === "amrap" || p.mode === "fortime")) {
        for (let j = 0; j < p.exercises.length && found.length < count; j++) {
          found.push(p.exercises[j]);
        }
        break;
      }
    }
    return found;
  }

  function setExercisePanels(currentEx, nextEx) {
    const nowPanel = $("#exercise-now-panel");
    const nextPanel = $("#exercise-next-panel");
    nowPanel?.classList.remove("hidden");
    nextPanel?.classList.remove("hidden");
    $("#current-exercise").textContent = currentEx?.name?.trim() || currentEx?.reps?.trim() || "—";
    $("#current-reps").textContent = currentEx ? formatExerciseDetail(currentEx) : "";
    if (nextEx) {
      $("#next-exercise").textContent = nextEx.name?.trim() || nextEx.reps?.trim() || "—";
      $("#next-reps").textContent = formatExerciseDetail(nextEx);
    } else {
      $("#next-exercise").textContent = "—";
      $("#next-reps").textContent = "";
    }
  }

  function renderBlockExerciseList(exercises, currentIndex) {
    const ul = $("#block-exercise-list");
    if (!ul) return;
    ul.innerHTML = exercises
      .map((ex, i) => {
        const name = ex.name?.trim() || ex.reps?.trim() || "—";
        const detail = formatExerciseDetail(ex);
        return `<li class="${i === currentIndex ? "current" : ""}"><span class="item-name">${escapeHtml(name)}</span><span class="item-reps">${escapeHtml(detail)}</span></li>`;
      })
      .join("");
  }

  function isMultiExerciseBlockPhase(phase) {
    return (
      phase &&
      (phase.mode === "amrap" || phase.mode === "fortime") &&
      (phase.exercises?.length || 0) > 1
    );
  }

  function canAdvanceExerciseInPhase(phase) {
    if (!isMultiExerciseBlockPhase(phase)) return false;
    return state.exerciseCursor < phase.exercises.length - 1;
  }

  function advanceExerciseInBlock() {
    const phase = timeline[phaseIndex];
    if (!canAdvanceExerciseInPhase(phase)) return false;
    state.exerciseCursor += 1;
    updateTimerUI(phase);
    broadcastStatus();
    return true;
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
    if (!g) return;
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
    $("#btn-add-block")?.addEventListener("click", () => addBlock("wod"));

    document.addEventListener("change", (e) => {
      const blockId = e.target.dataset?.blockId;
      const field = e.target.dataset?.field;
      if (!blockId || !field) return;
      const block = getBlock(blockId);
      if (!block) return;

      if (field === "category") {
        block.category = e.target.value;
        updateWorkoutPreview();
        return;
      }

      if (field === "mode") {
        block.mode = e.target.value;
        updateConfigVisibility(blockId);
        renderExercises(blockId);
        return;
      }

      if (field === "exerciseView") {
        block.exerciseView = e.target.value === "cards" ? "cards" : "list";
        return;
      }

      const index = e.target.dataset.index;
      if (index !== undefined) {
        block.exercises[+index][field] = e.target.value;
        if (field === "name" || field === "reps") updateWorkoutPreview();
        return;
      }

      block[field] = +e.target.value || 0;
      updateWorkoutPreview();
    });

    document.addEventListener("input", (e) => {
      const blockId = e.target.dataset?.blockId;
      const field = e.target.dataset?.field;
      const index = e.target.dataset?.index;
      if (!blockId || !field || index === undefined) return;
      const block = getBlock(blockId);
      if (!block?.exercises[+index]) return;
      block.exercises[+index][field] = e.target.value;
      if (field === "name" || field === "reps") updateWorkoutPreview();
    });

    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-add-exercise")) {
        const blockId = e.target.dataset.blockId;
        const block = getBlock(blockId);
        if (!block) return;
        block.exercises.push(defaultExercise());
        renderExercises(blockId);
        updateWorkoutPreview();
        return;
      }
      if (e.target.classList.contains("btn-remove-block")) {
        removeBlock(e.target.dataset.blockId);
        return;
      }
      if (e.target.classList.contains("layout-preset")) {
        applyLayoutRatio(+e.target.dataset.ratio);
        return;
      }
      if (!e.target.classList.contains("btn-remove")) return;
      const blockId = e.target.dataset.blockId;
      const index = +e.target.dataset.index;
      const block = getBlock(blockId);
      if (!block) return;
      block.exercises.splice(index, 1);
      renderExercises(blockId);
      updateWorkoutPreview();
    });

    $("#rest-between-blocks")?.addEventListener("change", (e) => {
      state.restBetweenBlocks = +e.target.value || 0;
      savePreferences();
      updateWorkoutPreview();
    });

    $("#template-select")?.addEventListener("change", (e) => {
      if (e.target.value) loadSelectedTemplate(e.target.value);
    });

    $("#btn-save-wod")?.addEventListener("click", () => {
      const name = $("#template-name")?.value;
      saveTemplate(name);
    });

    $("#btn-delete-wod")?.addEventListener("click", () => {
      const id = $("#template-select")?.value;
      if (!id || classicTemplates.some((t) => t.id === id)) {
        alert("Selecione um WOD salvo (não um clássico) para excluir.");
        return;
      }
      if (confirm("Excluir este WOD salvo?")) deleteSavedTemplate(id);
    });

    $("#layout-ratio")?.addEventListener("input", (e) => {
      applyLayoutRatio(+e.target.value);
    });

    $("#sound-enabled")?.addEventListener("change", (e) => {
      state.soundEnabled = e.target.checked;
      savePreferences();
      if (state.soundEnabled) unlockAudioInGesture();
    });

    $("#prep-seconds")?.addEventListener("change", (e) => {
      state.prepSeconds = Math.max(0, Math.min(30, +e.target.value || 0));
      e.target.value = state.prepSeconds;
      savePreferences();
    });

    $("#weight-unit-settings")?.addEventListener("change", (e) => {
      state.weightUnit = e.target.value;
      syncWeightUnitUI();
      savePreferences();
    });

    $("#btn-settings-setup")?.addEventListener("click", openSettings);
    $("#btn-settings-timer")?.addEventListener("click", openSettings);
    $("#btn-settings-close")?.addEventListener("click", closeSettings);
    $("#settings-backdrop")?.addEventListener("click", closeSettings);
    $("#btn-test-audio")?.addEventListener("click", testAudio);
    $("#btn-fullscreen")?.addEventListener("click", toggleFullscreen);
    $("#btn-round-plus")?.addEventListener("click", () => updateAmrapRounds(1, { local: true }));
    $("#btn-round-minus")?.addEventListener("click", () => updateAmrapRounds(-1, { local: true }));
    $("#btn-fortime-done")?.addEventListener("click", completeForTime);
    $("#btn-remote-round-plus")?.addEventListener("click", () => sendAmrapRoundsDelta(1));
    $("#btn-remote-round-minus")?.addEventListener("click", () => sendAmrapRoundsDelta(-1));

    $("#btn-start")?.addEventListener("click", () => {
      syncFormToState();
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
    $("#btn-pause")?.addEventListener("click", togglePause);
    $("#btn-skip")?.addEventListener("click", skipPhase);
    $("#btn-stop")?.addEventListener("click", stopWorkout);
    $("#btn-restart")?.addEventListener("click", () => {
      if (PAGE_MODE === "display") showScreen("pairing-screen");
      else showScreen("setup-screen");
    });

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

  function updateAmrapRounds(delta, opts = {}) {
    state.amrapRounds = Math.max(0, state.amrapRounds + delta);
    const roundEl = $("#round-count");
    if (roundEl) roundEl.textContent = state.amrapRounds;
    const remoteCount = $("#remote-round-count");
    if (remoteCount) remoteCount.textContent = state.amrapRounds;
    broadcastStatus();
    if (opts.local && PAGE_MODE === "display" && displaySync) {
      displaySync.send({ type: "amrap-rounds", payload: { rounds: state.amrapRounds } });
    }
  }

  function setAmrapRounds(rounds) {
    state.amrapRounds = Math.max(0, rounds);
    const roundEl = $("#round-count");
    if (roundEl) roundEl.textContent = state.amrapRounds;
    const remoteCount = $("#remote-round-count");
    if (remoteCount) remoteCount.textContent = state.amrapRounds;
    broadcastStatus();
  }

  function sendAmrapRoundsDelta(delta) {
    remoteSync?.send({ type: "amrap-rounds", payload: { delta } });
  }

  function completeForTime() {
    const phase = timeline[phaseIndex];
    if (!phase || phase.mode !== "fortime" || phase.countdown) return;
    if (phase.exerciseView === "cards" && advanceExerciseInBlock()) return;
    state.forTimeElapsed = Math.floor(remaining);
    clearInterval(tickInterval);
    whistleEnd();
    finishWorkout({ skipEndWhistle: true, forTimeDone: true });
  }

  function updateForTimeDoneButton(phase) {
    const btn = $("#btn-fortime-done");
    if (!btn) return;
    const show = phase?.mode === "fortime" && !phase.countdown && $("#timer-screen").classList.contains("active");
    btn.classList.toggle("hidden", !show);
    if (!show) return;
    const exs = phase.exercises || [];
    const onLast = state.exerciseCursor >= exs.length - 1;
    btn.textContent =
      phase.exerciseView === "cards" && exs.length > 1 && !onLast ? "Próximo" : "Concluído";
  }

  function showScreen(id) {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    $(`#${id}`)?.classList.add("active");
    broadcastStatus();
  }

  let timeline = [];
  let phaseIndex = 0;
  let remaining = 0;
  let phaseTotal = 0;
  let tickInterval = null;
  let lastTick = 0;

  function startWorkout(opts = {}) {
    if (!opts.remote) syncFormToState();
    timeline = buildTimeline(state);
    if (timeline.length === 0) {
      if (!opts.remote) {
        alert("Adicione pelo menos um exercício (nome ou reps) em algum bloco. Pesos são opcionais.");
      }
      return false;
    }

    closeSettings();
    phaseIndex = 0;
    state.paused = false;
    state.amrapRounds = 0;
    state.exerciseCursor = 0;
    state.forTimeElapsed = null;
    state.lastBeepSec = -1;
    state.halfTimeAnnounced = false;
    state.tenSecAnnounced = false;
    setAmrapRounds(0);
    $("#btn-fortime-done")?.classList.add("hidden");
    const restEl = $("#rest-between-blocks");
    if (restEl) restEl.value = state.restBetweenBlocks;
    applyLayoutRatio(state.layoutRatio);

    showScreen("timer-screen");
    requestWakeLock();

    if (state.prepSeconds > 0) {
      runPrepCountdown(state.prepSeconds, () => enterPhase(0, { skipStartWhistle: true }));
    } else {
      enterPhase(0);
    }
    broadcastStatus();
    return true;
  }

  function cancelPrepCountdown() {
    if (prepInterval) {
      clearInterval(prepInterval);
      prepInterval = null;
    }
    $("#prep-overlay")?.classList.add("hidden");
  }

  function runPrepCountdown(seconds, done) {
    cancelPrepCountdown();
    const overlay = $("#prep-overlay");
    const num = $("#prep-number");
    let count = seconds;

    overlay.classList.remove("hidden");
    num.textContent = count;
    playTone({ freq: 660, duration: 0.1, volume: 0.15, type: "sine" });

    prepInterval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        num.textContent = count;
        playTone({ freq: 660, duration: 0.1, volume: 0.15, type: "sine" });
        return;
      }

      clearInterval(prepInterval);
      prepInterval = null;
      num.textContent = "GO!";
      playTone({ freq: 880, duration: 0.15, volume: 0.2, type: "sine" });
      window.setTimeout(() => {
        overlay.classList.add("hidden");
        whistleStart();
        done();
      }, 1000);
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
    state.exerciseCursor = 0;

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
    $("#timer-phase").textContent = isRest ? "Trabalho" : phase.label || "Trabalho";
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

    const listPanel = $("#exercise-list-panel");
    const amrapPanel = $("#amrap-rounds-panel");
    const nowPanel = $("#exercise-now-panel");
    const nextPanel = $("#exercise-next-panel");

    if (phase.mode === "amrap") {
      amrapPanel.classList.remove("hidden");
    } else {
      amrapPanel.classList.add("hidden");
    }

    if (isRest) {
      listPanel.classList.add("hidden");
      const upcoming = findUpcomingExercises(phaseIndex + 1, 2);
      setExercisePanels(upcoming[0], upcoming[1]);
      $("#round-info").textContent = phase.blockLabel || "";
    } else if (phase.mode === "emom") {
      listPanel.classList.add("hidden");
      setExercisePanels(phase.exercise, null);
      const nextExIndex = (phase.exerciseIndex + 1) % phase.exercises.length;
      const isLastInterval = phase.interval === phase.totalIntervals;
      if (isLastInterval) {
        const upcoming = findUpcomingExercises(phaseIndex + 1, 1);
        if (upcoming[0]) {
          $("#next-exercise").textContent = upcoming[0].name?.trim() || upcoming[0].reps?.trim() || "—";
          $("#next-reps").textContent = formatExerciseDetail(upcoming[0]);
        } else {
          $("#next-exercise").textContent = "Fim do bloco";
          $("#next-reps").textContent = "";
        }
      } else {
        const nextEx = phase.exercises[nextExIndex];
        $("#next-exercise").textContent = nextEx.name?.trim() || nextEx.reps?.trim() || "—";
        $("#next-reps").textContent = formatExerciseDetail(nextEx);
      }
      $("#round-info").textContent = `Minuto ${phase.interval} / ${phase.totalIntervals}`;
    } else if (phase.mode === "tabata") {
      listPanel.classList.add("hidden");
      setExercisePanels(phase.exercise, null);
      const isLastRound = phase.round === phase.totalRounds;
      if (isLastRound) {
        const upcoming = findUpcomingExercises(phaseIndex + 1, 1);
        if (upcoming[0]) {
          $("#next-exercise").textContent = upcoming[0].name?.trim() || upcoming[0].reps?.trim() || "—";
          $("#next-reps").textContent = formatExerciseDetail(upcoming[0]);
        } else {
          $("#next-exercise").textContent = "Fim do bloco";
          $("#next-reps").textContent = "";
        }
      } else {
        const nextEx = phase.exercises[phase.round % phase.exercises.length];
        $("#next-exercise").textContent = nextEx.name?.trim() || nextEx.reps?.trim() || "—";
        $("#next-reps").textContent = formatExerciseDetail(nextEx);
      }
      $("#round-info").textContent = `Round ${phase.round} / ${phase.totalRounds}`;
    } else if (phase.mode === "amrap" || phase.mode === "fortime") {
      const exs = phase.exercises || [];
      const view = phase.exerciseView || "list";
      const cursor = state.exerciseCursor;
      const capLabel = phase.countdown
        ? `Time cap: ${Math.floor(phaseTotal / 60)} min`
        : phase.mode === "amrap"
          ? "AMRAP — sem limite"
          : "For Time — sem limite";

      if (view === "list" && exs.length > 0) {
        nowPanel?.classList.add("hidden");
        nextPanel?.classList.add("hidden");
        listPanel.classList.remove("hidden");
        renderBlockExerciseList(exs, cursor);
      } else {
        listPanel.classList.add("hidden");
        setExercisePanels(exs[cursor], exs[cursor + 1]);
      }

      if (exs.length > 1) {
        $("#round-info").textContent = `${capLabel} · Exercício ${cursor + 1} / ${exs.length}`;
      } else {
        $("#round-info").textContent = capLabel;
      }
    } else {
      listPanel.classList.add("hidden");
      setExercisePanels(phase.exercise, null);
      const upcoming = findUpcomingExercises(phaseIndex + 1, 1);
      if (upcoming[0]) {
        $("#next-exercise").textContent = upcoming[0].name?.trim() || upcoming[0].reps?.trim() || "—";
        $("#next-reps").textContent = formatExerciseDetail(upcoming[0]);
      } else {
        $("#next-exercise").textContent = "—";
        $("#next-reps").textContent = "";
      }
      const exNum = phase.exerciseIndex + 1;
      $("#round-info").textContent = `Exercício ${exNum} / ${phase.exercises.length}`;
    }
    updateForTimeDoneButton(phase);
    broadcastStatus();
  }

  function togglePause() {
    state.paused = !state.paused;
    $("#btn-pause").textContent = state.paused ? "Continuar" : "Pausar";
    if (!state.paused) lastTick = performance.now();
  }

  function skipPhase() {
    const phase = timeline[phaseIndex];
    if (canAdvanceExerciseInPhase(phase)) {
      whistleEnd();
      advanceExerciseInBlock();
      return;
    }
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
    cancelPrepCountdown();
    releaseWakeLock();
    if (PAGE_MODE === "display") showScreen("pairing-screen");
    else showScreen("setup-screen");
  }

  function finishWorkout(opts = {}) {
    clearInterval(tickInterval);
    cancelPrepCountdown();
    releaseWakeLock();
    if (!opts.skipEndWhistle) whistleEnd();
    let summary = "Bom treino!";
    if (state.amrapRounds > 0) summary += ` Rounds AMRAP: ${state.amrapRounds}.`;
    if (state.forTimeElapsed !== null) summary += ` For Time: ${formatClockTime(state.forTimeElapsed)}.`;
    summary += " Configure um novo WOD quando quiser.";
    $("#finished-summary").textContent = summary;
    showScreen("finished-screen");
  }

  function handleRemoteCommand(data) {
    switch (data.type) {
      case "config":
        applyRemoteConfig(data.payload);
        break;
      case "start":
        if (state.soundEnabled) unlockAudioInGesture();
        startWorkout({ remote: true });
        break;
      case "pause":
        if (!state.paused) togglePause();
        break;
      case "resume":
        if (state.paused) togglePause();
        break;
      case "skip":
        skipPhase();
        break;
      case "stop":
        stopWorkout();
        break;
      case "amrap-rounds": {
        const p = data.payload || {};
        if (p.rounds !== undefined) setAmrapRounds(p.rounds);
        else if (p.delta) updateAmrapRounds(p.delta);
        break;
      }
      default:
        break;
    }
  }

  function initDisplay() {
    state.blockList = [];
    loadPreferences();
    buildProgressRing();
    applyLayoutRatio(state.layoutRatio);
    syncWeightUnitUI();
    const soundEl = $("#sound-enabled");
    if (soundEl) soundEl.checked = state.soundEnabled;
    const prepEl = $("#prep-seconds");
    if (prepEl) prepEl.value = state.prepSeconds;
    bindEvents();

    const codeEl = $("#pairing-code");
    const statusEl = $("#pairing-status");

    if (typeof WodSync === "undefined") {
      codeEl.textContent = "ERRO";
      statusEl.textContent = "sync.js não carregou. Recarregue a página.";
      return;
    }

    displaySync = WodSync.createHost({
      onReady(code) {
        codeEl.textContent = code;
        statusEl.textContent = "Conectando ao servidor…";
      },
      onSignalingReady() {
        statusEl.textContent = "Aguardando controle remoto…";
      },
      onConnect() {
        statusEl.textContent = "Controle conectado!";
        $("#remote-connected")?.classList.add("visible");
        broadcastStatus();
      },
      onDisconnect() {
        statusEl.textContent = "Controle desconectado — aguardando…";
        $("#remote-connected")?.classList.remove("visible");
        broadcastStatus();
      },
      onMessage: handleRemoteCommand,
      onError(err) {
        const msg = err?.message || err?.type || "erro";
        statusEl.textContent = `Sem conexão (${msg}). Código válido — tentando reconectar…`;
      },
    });
  }

  function setRemoteUi(connected) {
    $("#btn-send-config").disabled = !connected;
    $("#btn-remote-start").disabled = !connected;
    $("#btn-remote-pause").disabled = !connected;
    $("#btn-remote-stop").disabled = !connected;
    $("#btn-remote-round-plus").disabled = !connected;
    $("#btn-remote-round-minus").disabled = !connected;
    $("#remote-status").textContent = connected ? "Conectado à tela" : "Desconectado";
    $("#remote-status").classList.toggle("connected", connected);
  }

  function updateRemoteLiveStatus(p) {
    const pauseBtn = $("#btn-remote-pause");
    if (pauseBtn) pauseBtn.textContent = p.paused ? "Continuar" : "Pausar";

    const amrapPanel = $("#remote-amrap-panel");
    if (amrapPanel) {
      const showAmrap = p.screen === "timer-screen" && p.mode === "amrap";
      amrapPanel.classList.toggle("hidden", !showAmrap);
    }
    if (p.amrapRounds !== undefined) {
      const remoteCount = $("#remote-round-count");
      if (remoteCount) remoteCount.textContent = p.amrapRounds;
    }

    if (p.screen === "timer-screen" && p.label) {
      let text = `${p.block} · ${p.label} · ${p.remaining}s`;
      if (p.mode === "amrap" && p.amrapRounds !== undefined) text += ` · ${p.amrapRounds} rounds`;
      if (p.forTimeElapsed !== null && p.forTimeElapsed !== undefined) {
        text = `${p.block} · For Time: ${formatClockTime(p.forTimeElapsed)}`;
      }
      $("#remote-live-status").textContent = text;
    } else if (p.screen === "finished-screen") {
      $("#remote-live-status").textContent = "Treino concluído na tela";
    } else if (p.screen === "pairing-screen") {
      $("#remote-live-status").textContent = "Tela aguardando";
    } else {
      $("#remote-live-status").textContent = "—";
    }
  }

  async function initRemote() {
    state.blockList = [];
    loadPreferences();
    syncWeightUnitUI();
    await loadClassicTemplates();
    renderTemplateSelectors();
    renderWorkoutList();
    updateWorkoutPreview();
    const restEl = $("#rest-between-blocks");
    if (restEl) restEl.value = state.restBetweenBlocks;
    bindEvents();
    setRemoteUi(false);

    $("#btn-connect")?.addEventListener("click", () => {
      const code = WodSync.normalizeCode($("#remote-code").value);
      if (code.length < 6) {
        alert("Digite o código de 6 caracteres exibido na tela.");
        return;
      }
      remoteSync?.destroy();
      $("#remote-status").textContent = "Conectando…";
      remoteSync = WodSync.connect(code, {
        onConnect() {
          setRemoteUi(true);
          remoteSync.send({ type: "config", payload: getSerializableConfig() });
        },
        onDisconnect() {
          setRemoteUi(false);
          $("#remote-live-status").textContent = "—";
        },
        onMessage(data) {
          if (data.type === "status") {
            updateRemoteLiveStatus(data.payload || {});
          } else if (data.type === "amrap-rounds") {
            const rounds = data.payload?.rounds;
            if (rounds !== undefined) {
              const remoteCount = $("#remote-round-count");
              if (remoteCount) remoteCount.textContent = rounds;
            }
          }
        },
        onError() {
          setRemoteUi(false);
          $("#remote-status").textContent = "Código inválido ou tela offline";
        },
      });
    });

    $("#btn-send-config")?.addEventListener("click", () => {
      syncFormToState();
      remoteSync?.send({ type: "config", payload: getSerializableConfig() });
      $("#remote-status").textContent = "Configuração enviada";
    });

    $("#btn-remote-start")?.addEventListener("click", () => {
      syncFormToState();
      remoteSync?.send({ type: "config", payload: getSerializableConfig() });
      remoteSync?.send({ type: "start" });
    });

    $("#btn-remote-pause")?.addEventListener("click", () => {
      const btn = $("#btn-remote-pause");
      const isPaused = btn?.textContent === "Continuar";
      remoteSync?.send({ type: isPaused ? "resume" : "pause" });
    });

    $("#btn-remote-stop")?.addEventListener("click", () => {
      remoteSync?.send({ type: "stop" });
    });
  }

  function boot() {
    try {
      if (PAGE_MODE === "display") initDisplay();
      else if (PAGE_MODE === "remote") {
        initRemote().catch((err) => {
          throw err;
        });
      } else init().catch((err) => {
        throw err;
      });
    } catch (err) {
      console.error("WOD Timer init error:", err);
      alert(`Erro ao iniciar o app: ${err.message}\n\nRecarregue com Cmd+Shift+R.`);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
