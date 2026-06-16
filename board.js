(function () {
  "use strict";

  const COLUMN_HEADERS = {
    alongamento: "WARM-UP",
    tecnica: "STRENGTH",
    wod: "WOD",
  };

  const SUBSECTION_LABELS = {
    alongamento: ["WARM-UP", "MOBILITY"],
    tecnica: ["STRENGTH", "REST", "STRENGTH"],
  };

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function exercisesEqual(a, b) {
    return (
      a.name === b.name &&
      a.reps === b.reps &&
      a.weightM === b.weightM &&
      a.weightF === b.weightF
    );
  }

  function detectRounds(exercises) {
    const n = exercises.length;
    for (let r = 1; r <= n / 2; r++) {
      if (n % r !== 0) continue;
      const round = exercises.slice(0, r);
      let match = true;
      for (let i = r; i < n; i += r) {
        const slice = exercises.slice(i, i + r);
        if (slice.length !== r || !round.every((ex, idx) => exercisesEqual(ex, slice[idx]))) {
          match = false;
          break;
        }
      }
      if (match) return { count: n / r, exercises: round };
    }
    return { count: 1, exercises };
  }

  function splitPrefixAndRounds(exercises) {
    if (exercises.length < 2) {
      return { prefix: [], rounds: detectRounds(exercises) };
    }

    const rest = exercises.slice(1);
    const rounds = detectRounds(rest);
    if (rounds.count > 1) {
      return { prefix: [exercises[0]], rounds };
    }

    return { prefix: [], rounds: detectRounds(exercises) };
  }

  function formatWeight(ex, unit) {
    const parts = [];
    if (ex.weightM?.trim()) parts.push(ex.weightM.trim());
    if (ex.weightF?.trim()) parts.push(ex.weightF.trim());

    if (!parts.length) return "";

    const joined = parts.join("/");
    if (joined.includes("%")) return joined;
    if (/[a-z]/i.test(joined)) return joined;
    return `${joined}${unit}`;
  }

  function exerciseLineInner(ex, unit) {
    const name = (ex.name || "").trim();
    const reps = (ex.reps || "").trim();
    const weight = formatWeight(ex, unit);

    if (!name && !reps) return "";

    if (name.toLowerCase() === "descanso") {
      return `<span class="name">REST</span>`;
    }

    const nameUpper = escapeHtml(name.toUpperCase());
    const repsHtml = reps ? `<span class="num">${escapeHtml(reps)}</span> ` : "";
    let weightHtml = "";

    if (weight) {
      const w = escapeHtml(weight.toUpperCase());
      weightHtml = weight.includes("%")
        ? ` <span class="weight">@ ${w}</span>`
        : ` <span class="weight">#${w}</span>`;
    }

    return `${repsHtml}<span class="name">${nameUpper}</span>${weightHtml}`;
  }

  function formatExerciseLine(ex, unit) {
    const inner = exerciseLineInner(ex, unit);
    if (!inner) return "";
    return `<div class="board-line">${inner}</div>`;
  }

  function formatModeBanner(block) {
    if (block.mode === "emom") {
      return `<div class="board-mode-banner">EMOM ${block.totalMinutes}'</div>`;
    }
    if (block.mode === "amrap" && block.timeCapMinutes > 0) {
      return `<div class="board-mode-banner">AMRAP ${block.timeCapMinutes}'</div>`;
    }
    if (block.mode === "tabata") {
      return `<div class="board-mode-banner">TABATA ×${block.tabataRounds}</div>`;
    }
    if (block.mode === "fortime" && block.timeCapMinutes > 0) {
      const isRest = block.exercises.some((ex) => ex.name.toLowerCase() === "descanso");
      if (isRest) {
        return `<div class="board-mode-banner">REST ${block.timeCapMinutes}'</div>`;
      }
      return `<div class="board-mode-banner">FOR TIME ${block.timeCapMinutes}'</div>`;
    }
    return "";
  }

  function renderRoundGroup(exercises, unit, roundCount) {
    let html = "";
    if (roundCount > 1) {
      html += `<div class="board-rounds-label">${roundCount} RDS</div>`;
    }
    exercises.forEach((ex) => {
      const line = formatExerciseLine(ex, unit);
      if (line) html += line;
    });
    return html;
  }

  function renderAlongamentoBlock(block, unit, subsectionIndex) {
    const label = SUBSECTION_LABELS.alongamento[subsectionIndex] || "WARM-UP";
    let html = `<div class="board-section">`;

    if (subsectionIndex > 0) {
      html += `<div class="board-section-title">${label}</div>`;
    }

    const active = block.exercises.filter((ex) => ex.name.trim() || ex.reps.trim());
    const { prefix, rounds } = splitPrefixAndRounds(active);

    prefix.forEach((ex) => {
      html += formatExerciseLine(ex, unit);
    });

    html += renderRoundGroup(rounds.exercises, unit, rounds.count);
    html += `</div>`;
    return html;
  }

  function renderTecnicaBlock(block, unit, subsectionIndex) {
    const active = block.exercises.filter((ex) => ex.name.trim() || ex.reps.trim());
    if (!active.length) return "";

    if (block.mode === "fortime" && block.timeCapMinutes > 0) {
      return `<div class="board-section">${formatModeBanner(block)}</div>`;
    }

    const exerciseName = active[0]?.name || "STRENGTH";
    let html = `<div class="board-section">`;
    html += `<div class="board-section-title">${escapeHtml(exerciseName.toUpperCase())}</div>`;

    active.forEach((ex) => {
      html += formatExerciseLine(ex, unit);
      if (ex.restSeconds) {
        html += `<div class="board-note board-note--red">REST ${Math.round(+ex.restSeconds / 60) || ex.restSeconds}'</div>`;
      }
    });

    html += `</div>`;
    return html;
  }

  function renderWodBlock(block, unit) {
    const active = block.exercises.filter((ex) => ex.name.trim() || ex.reps.trim());
    if (!active.length) return "";

    let html = `<div class="board-section">${formatModeBanner(block)}`;

    if (block.mode === "emom" && active.length > 1) {
      html += `<div class="board-emom-cycle">`;
      html += `<div class="board-note board-note--red">${active.length} MIN CYCLE</div>`;
      active.forEach((ex, i) => {
        const minute = i + 1;
        const inner = exerciseLineInner(ex, unit);
        if (inner) {
          html += `<div class="board-line"><span class="num">MIN ${minute}:</span> ${inner}</div>`;
        }
      });
      html += `</div>`;
    } else {
      active.forEach((ex) => {
        html += formatExerciseLine(ex, unit);
      });
    }

    html += `</div>`;
    return html;
  }

  function groupBlocks(blockList) {
    const groups = { alongamento: [], tecnica: [], wod: [] };
    blockList.forEach((block) => {
      const cat = block.category;
      if (groups[cat]) groups[cat].push(block);
    });
    return groups;
  }

  function renderColumn(category, blocks, unit) {
    const header = COLUMN_HEADERS[category] || category.toUpperCase();
    let body = "";

    if (category === "alongamento") {
      blocks.forEach((block, i) => {
        body += renderAlongamentoBlock(block, unit, i);
      });
    } else if (category === "tecnica") {
      blocks.forEach((block, i) => {
        body += renderTecnicaBlock(block, unit, i);
      });
    } else if (category === "wod") {
      blocks.forEach((block) => {
        body += renderWodBlock(block, unit);
      });
    }

    if (!body.trim()) {
      body = `<div class="board-note">—</div>`;
    }

    return `
      <section class="board-column" aria-label="${escapeHtml(header)}">
        <h2 class="board-column-header">${escapeHtml(header)}</h2>
        ${body}
      </section>
    `;
  }

  function renderBoard(workout) {
    const unit = workout.config?.weightUnit === "kg" ? "kg" : "lb";
    const blocks = workout.config?.blockList || [];
    const groups = groupBlocks(blocks);

    const garland = Array.from({ length: 21 }, () => "<span></span>").join("");

    return `
      <div class="board-frame">
        <div class="board-garland" aria-hidden="true">${garland}</div>
        <div class="board-surface">
          <h1 class="board-title">${escapeHtml(workout.name)}</h1>
          <div class="board-columns">
            ${renderColumn("alongamento", groups.alongamento, unit)}
            ${renderColumn("tecnica", groups.tecnica, unit)}
            ${renderColumn("wod", groups.wod, unit)}
          </div>
        </div>
        <div class="board-tray" aria-hidden="true">
          <div class="board-marker board-marker--black"></div>
          <div class="board-marker board-marker--red"></div>
          <div class="board-eraser"></div>
        </div>
      </div>
    `;
  }

  async function init() {
    const surface = document.getElementById("board-root");
    const select = document.getElementById("workout-select");
    const params = new URLSearchParams(window.location.search);
    const initialId = params.get("workout");

    let workouts = [];
    try {
      workouts = await WodCore.fetchWorkouts();
    } catch (err) {
      surface.innerHTML = `<p class="board-error">Erro ao carregar treinos: ${escapeHtml(err.message)}</p>`;
      return;
    }

    workouts.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    select.innerHTML = workouts
      .map((w) => `<option value="${escapeHtml(w.id)}">${escapeHtml(w.name)}</option>`)
      .join("");

    function showWorkout(id) {
      const workout = workouts.find((w) => w.id === id);
      if (!workout) {
        surface.innerHTML = `<p class="board-error">Treino não encontrado.</p>`;
        return;
      }
      document.title = `${workout.name} — Quadro`;
      surface.innerHTML = renderBoard(workout);
      const url = new URL(window.location.href);
      url.searchParams.set("workout", id);
      window.history.replaceState({}, "", url);
    }

    select.addEventListener("change", () => showWorkout(select.value));

    const defaultId = initialId && workouts.some((w) => w.id === initialId)
      ? initialId
      : workouts.find((w) => w.id === "terca-feira")?.id || workouts[0]?.id;

    if (defaultId) {
      select.value = defaultId;
      showWorkout(defaultId);
    } else {
      surface.innerHTML = `<p class="board-error">Nenhum treino disponível.</p>`;
    }

    document.getElementById("btn-print")?.addEventListener("click", () => window.print());
    document.getElementById("btn-fullscreen")?.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
