(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.WodCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
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

  const WEIGHT_UNITS = [
    { value: "lb", label: "Libras (lb)" },
    { value: "kg", label: "Quilos (kg)" },
  ];

  const PLATES_LB = [45, 35, 25, 10, 5, 2.5];
  const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

  const DEFAULT_BARS = {
    lb: 45,
    kg: 20,
  };

  const PERCENTAGES = [50, 60, 75, 80, 90, 95, 110];

  function defaultExercise() {
    return { name: "", reps: "", weightM: "", weightF: "", restSeconds: "" };
  }

  const EXERCISE_VIEWS = [
    { value: "list", label: "Lista completa" },
    { value: "cards", label: "Card a card" },
  ];

  function defaultBlock() {
    return {
      mode: "sequential",
      workSeconds: 60,
      restSeconds: 15,
      intervalSeconds: 60,
      totalMinutes: 12,
      timeCapMinutes: 0,
      tabataRounds: 8,
      exerciseView: "list",
      exercises: [],
    };
  }

  function createBlockId() {
    return `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function defaultBlockEntry(category = "wod", id) {
    const cat = BLOCKS.includes(category) ? category : "wod";
    return {
      id: id || createBlockId(),
      category: cat,
      ...defaultBlock(),
    };
  }

  function normalizeBlockEntry(entry) {
    const base = defaultBlockEntry(entry?.category || "wod", entry?.id);
    const merged = { ...base, ...entry, category: BLOCKS.includes(entry?.category) ? entry.category : base.category };
    merged.exercises = Array.isArray(entry?.exercises)
      ? entry.exercises.map(normalizeExercise)
      : [];
    return merged;
  }

  function normalizeBlockList(payload) {
    if (Array.isArray(payload?.blockList)) {
      return payload.blockList.map(normalizeBlockEntry);
    }
    if (payload?.blocks) {
      const list = [];
      BLOCKS.forEach((cat) => {
        const raw = payload.blocks[cat];
        if (!raw) return;
        const normalized = normalizeBlock(raw);
        if (normalized.exercises.length > 0) {
          list.push(normalizeBlockEntry({ ...normalized, category: cat }));
        }
      });
      return list;
    }
    return [];
  }

  function getBlockList(state) {
    if (Array.isArray(state?.blockList)) return state.blockList;
    if (state?.blocks) {
      return normalizeBlockList({ blocks: state.blocks });
    }
    return [];
  }

  function defaultPreferences() {
    return {
      weightUnit: "lb",
      layoutRatio: 70,
      soundEnabled: true,
      prepSeconds: 3,
      restBetweenBlocks: 60,
    };
  }

  function normalizeWorkoutConfig(config) {
    const payload = config || {};
    const normalized = {
      restBetweenBlocks: payload.restBetweenBlocks ?? 0,
      weightUnit: payload.weightUnit ?? "lb",
      blockList: normalizeBlockList(payload),
    };
    if (payload.layoutRatio !== undefined) normalized.layoutRatio = payload.layoutRatio;
    if (payload.soundEnabled !== undefined) normalized.soundEnabled = payload.soundEnabled;
    if (payload.prepSeconds !== undefined) normalized.prepSeconds = payload.prepSeconds;
    return normalized;
  }

  /** Converte um arquivo JSON de treino no formato usado pelo app. */
  function parseWorkoutTemplate(data) {
    if (!data?.id || !data?.name) {
      throw new Error("Workout JSON must include id and name");
    }
    return {
      id: String(data.id),
      name: String(data.name),
      description: data.description || "",
      classic: Boolean(data.classic),
      config: normalizeWorkoutConfig(data.config),
    };
  }

  function listWorkoutIds(workoutsDir, fs, path) {
    const indexPath = path.join(workoutsDir, "index.json");
    if (fs.existsSync(indexPath)) {
      const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      if (Array.isArray(index.workouts)) return index.workouts;
    }
    return fs
      .readdirSync(workoutsDir)
      .filter((file) => file.endsWith(".json") && !file.startsWith("_") && file !== "index.json")
      .map((file) => file.replace(/\.json$/, ""))
      .sort();
  }

  /** Carrega treinos de workouts/*.json (Node.js / testes). */
  function loadWorkoutsSync(workoutsDir) {
    const fs = require("fs");
    const path = require("path");
    const dir = workoutsDir || path.join(__dirname, "workouts");
    return listWorkoutIds(dir, fs, path).map((id) => {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), "utf8"));
      return parseWorkoutTemplate(raw);
    });
  }

  /** Carrega treinos via fetch (navegador). */
  async function fetchWorkouts(basePath = "workouts/") {
    const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
    const indexRes = await fetch(`${normalizedBase}index.json`);
    if (!indexRes.ok) {
      throw new Error(`Workouts index not found (${indexRes.status})`);
    }
    const { workouts: ids } = await indexRes.json();
    if (!Array.isArray(ids)) {
      throw new Error("Workouts index must include a workouts array");
    }
    return Promise.all(
      ids.map(async (id) => {
        const res = await fetch(`${normalizedBase}${id}.json`);
        if (!res.ok) {
          throw new Error(`Workout "${id}" not found (${res.status})`);
        }
        return parseWorkoutTemplate(await res.json());
      })
    );
  }

  function normalizeExercise(ex) {
    return {
      name: ex?.name ?? "",
      reps: ex?.reps ?? "",
      weightM: ex?.weightM ?? "",
      weightF: ex?.weightF ?? "",
      restSeconds: ex?.restSeconds ?? "",
    };
  }

  function exerciseRestSeconds(ex, config) {
    if (ex?.restSeconds !== undefined && ex.restSeconds !== "" && ex.restSeconds !== null) {
      return Math.max(0, +ex.restSeconds || 0);
    }
    return Math.max(0, config.restSeconds || 0);
  }

  function normalizeBlock(block) {
    const base = defaultBlock();
    const merged = { ...base, ...block };
    merged.exercises = Array.isArray(block?.exercises)
      ? block.exercises.map(normalizeExercise)
      : base.exercises.map(normalizeExercise);
    return merged;
  }

  function isExerciseActive(ex) {
    return Boolean(ex.name.trim() || ex.reps.trim());
  }

  function resolveExerciseDisplay(ex) {
    return {
      ...ex,
      name: ex.name.trim() || ex.reps.trim() || "Exercício",
    };
  }

  function getActiveBlocks(state) {
    return getBlockList(state)
      .filter((block) => block.exercises?.some(isExerciseActive))
      .map((block) => ({
        key: block.id,
        category: block.category,
        label: BLOCK_LABELS[block.category] || block.category,
        config: {
          ...block,
          exercises: block.exercises.filter(isExerciseActive).map(resolveExerciseDisplay),
        },
      }));
  }

  function estimateBlockSeconds(block, config) {
    const n = config.exercises.length;
    if (!n) return 0;

    switch (config.mode) {
      case "sequential": {
        let total = n * config.workSeconds;
        for (let i = 0; i < n - 1; i++) {
          total += exerciseRestSeconds(config.exercises[i], config);
        }
        return total;
      }
      case "emom":
        return config.totalMinutes * config.intervalSeconds;
      case "tabata":
        return config.tabataRounds * 30 - 10;
      case "amrap":
      case "fortime":
        return config.timeCapMinutes > 0 ? config.timeCapMinutes * 60 : 0;
      default:
        return 0;
    }
  }

  function estimateDuration(state) {
    const active = getActiveBlocks(state);
    let total = 0;
    active.forEach((block, i) => {
      total += estimateBlockSeconds(block, block.config);
      if (i < active.length - 1) total += state.restBetweenBlocks || 0;
    });
    return total;
  }

  function formatDuration(seconds) {
    if (seconds <= 0) return "sem limite";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    if (s === 0) return `${m} min`;
    return `${m} min ${s}s`;
  }

  function formatClockTime(totalSeconds) {
    const sec = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function buildTimeline(state) {
    const active = getActiveBlocks(state);
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
          if (i < exercises.length - 1) {
            const restDur = exerciseRestSeconds(ex, config);
            if (restDur > 0) {
            timeline.push({
              type: "rest",
              blockKey: block.key,
              blockLabel: block.label,
              mode: config.mode,
              duration: restDur,
              countdown: true,
              label: "Descanso",
            });
            }
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
        for (let r = 0; r < config.tabataRounds; r++) {
          const exIndex = r % exercises.length;
          const ex = exercises[exIndex];
          timeline.push({
            type: "work",
            blockKey: block.key,
            blockLabel: block.label,
            mode: config.mode,
            exercise: ex,
            exerciseIndex: exIndex,
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
              exerciseIndex: exIndex,
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
          exerciseView: config.exerciseView === "cards" ? "cards" : "list",
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

  function createStateFromConfig(payload) {
    return {
      blockList: normalizeBlockList(payload),
      restBetweenBlocks: payload.restBetweenBlocks ?? 60,
      weightUnit: payload.weightUnit ?? "lb",
    };
  }

  function getPlatesForUnit(unit) {
    return unit === "kg" ? PLATES_KG : PLATES_LB;
  }

  function roundWeight(value, unit) {
    const step = unit === "kg" ? 0.25 : 0.5;
    return Math.round(value / step) * step;
  }

  /**
   * Calcula anilhas por lado para atingir o peso total na barra.
   * Retorna { perSide, plates, remainder, achievable, totalWeight }.
   */
  function calculatePlatesPerSide(totalWeight, barWeight, unit = "lb") {
    const plates = getPlatesForUnit(unit);
    const minStep = unit === "kg" ? 0.25 : 0.5;
    const target = roundWeight(Number(totalWeight) || 0, unit);
    const bar = roundWeight(Number(barWeight) || 0, unit);
    const load = roundWeight(Math.max(0, target - bar), unit);
    let perSide = roundWeight(load / 2, unit);

    if (perSide < 0) perSide = 0;

    const result = [];
    let remainder = perSide;

    for (const plate of plates) {
      while (remainder + minStep / 4 >= plate) {
        result.push(plate);
        remainder = roundWeight(remainder - plate, unit);
      }
    }

    const usedPerSide = result.reduce((sum, p) => sum + p, 0);
    const achievable = roundWeight(bar + usedPerSide * 2, unit);

    return {
      unit,
      totalWeight: target,
      barWeight: bar,
      perSide: usedPerSide,
      plates: result,
      remainder: roundWeight(remainder, unit),
      achievable,
      exact: remainder === 0 && achievable === target,
    };
  }

  function formatPlatesList(plates, unit) {
    if (!plates.length) return "—";
    const counts = {};
    plates.forEach((p) => {
      const key = String(p);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([w, n]) => (n > 1 ? `${n}×${w}` : `${w}`))
      .join(" + ")
      + ` ${unit}`;
  }

  function buildPercentageTable(baseWeight, barWeight, unit = "lb", percentages = PERCENTAGES) {
    const base = Number(baseWeight) || 0;
    return percentages.map((pct) => {
      const target = roundWeight((base * pct) / 100, unit);
      const calc = calculatePlatesPerSide(target, barWeight, unit);
      return {
        percent: pct,
        targetWeight: target,
        ...calc,
      };
    });
  }

  function serializeConfig(state) {
    return {
      blockList: JSON.parse(JSON.stringify(getBlockList(state))),
      restBetweenBlocks: state.restBetweenBlocks,
      weightUnit: state.weightUnit ?? "lb",
      layoutRatio: state.layoutRatio,
      soundEnabled: state.soundEnabled,
      prepSeconds: state.prepSeconds,
    };
  }

  return {
    BLOCKS,
    BLOCK_LABELS,
    BLOCK_CATEGORIES: BLOCKS,
    MODES,
    EXERCISE_VIEWS,
    WEIGHT_UNITS,
    PLATES_LB,
    PLATES_KG,
    DEFAULT_BARS,
    PERCENTAGES,
    parseWorkoutTemplate,
    normalizeWorkoutConfig,
    loadWorkoutsSync,
    fetchWorkouts,
    defaultExercise,
    defaultBlock,
    defaultBlockEntry,
    createBlockId,
    normalizeBlockEntry,
    normalizeBlockList,
    getBlockList,
    defaultPreferences,
    normalizeExercise,
    normalizeBlock,
    isExerciseActive,
    resolveExerciseDisplay,
    getActiveBlocks,
    estimateBlockSeconds,
    estimateDuration,
    formatDuration,
    formatClockTime,
    buildTimeline,
    createStateFromConfig,
    getPlatesForUnit,
    roundWeight,
    calculatePlatesPerSide,
    formatPlatesList,
    buildPercentageTable,
    serializeConfig,
  };
});
