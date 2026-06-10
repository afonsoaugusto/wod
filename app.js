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
    { value: "amrap", label: "AMRAP" },
    { value: "fortime", label: "For Time" },
  ];

  const SEGMENT_COUNT = 60;

  const state = {
    blocks: {},
    restBetweenBlocks: 60,
    timer: null,
    paused: false,
    segments: [],
  };

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
      exercises: [{ name: "", reps: "" }],
    };
  }

  function init() {
    BLOCKS.forEach((block) => {
      state.blocks[block] = defaultBlock();
      renderBlockConfig(block);
      renderExercises(block);
    });

    buildProgressRing();
    bindEvents();
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

    document.addEventListener("click", (e) => {
      if (!e.target.classList.contains("btn-remove")) return;
      const block = e.target.dataset.block;
      const index = +e.target.dataset.index;
      if (state.blocks[block].exercises.length <= 1) return;
      state.blocks[block].exercises.splice(index, 1);
      renderExercises(block);
    });

    $("#rest-between-blocks").addEventListener("change", (e) => {
      state.restBetweenBlocks = +e.target.value || 0;
    });

    $("#btn-start").addEventListener("click", startWorkout);
    $("#btn-pause").addEventListener("click", togglePause);
    $("#btn-skip").addEventListener("click", skipPhase);
    $("#btn-stop").addEventListener("click", stopWorkout);
    $("#btn-restart").addEventListener("click", () => showScreen("setup-screen"));
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

    phaseIndex = 0;
    state.paused = false;
    showScreen("timer-screen");
    enterPhase(0);
  }

  function enterPhase(index) {
    if (index >= timeline.length) {
      finishWorkout();
      return;
    }

    phaseIndex = index;
    const phase = timeline[index];
    phaseTotal = phase.duration || 60;
    remaining = phase.countdown ? phaseTotal : 0;
    lastTick = performance.now();

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
      if (remaining <= 0) {
        remaining = 0;
        updateTimerUI(phase);
        clearInterval(tickInterval);
        setTimeout(() => enterPhase(phaseIndex + 1), 300);
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
    enterPhase(phaseIndex + 1);
  }

  function stopWorkout() {
    clearInterval(tickInterval);
    showScreen("setup-screen");
  }

  function finishWorkout() {
    clearInterval(tickInterval);
    $("#finished-summary").textContent = "Bom treino! Configure um novo WOD quando quiser.";
    showScreen("finished-screen");
  }

  init();
})();
