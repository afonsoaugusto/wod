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

  function getActiveBlocks(state) {
    return BLOCKS.filter((b) => {
      const ex = state.blocks[b].exercises.filter((e) => e.name.trim());
      return ex.length > 0;
    }).map((b) => ({
      key: b,
      label: BLOCK_LABELS[b],
      config: {
        ...state.blocks[b],
        exercises: state.blocks[b].exercises.filter((e) => e.name.trim()),
      },
    }));
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
    const state = {
      blocks: {},
      restBetweenBlocks: payload.restBetweenBlocks ?? 60,
    };
    BLOCKS.forEach((b) => {
      state.blocks[b] = payload.blocks?.[b]
        ? { ...defaultBlock(), ...payload.blocks[b] }
        : defaultBlock();
    });
    return state;
  }

  return {
    BLOCKS,
    BLOCK_LABELS,
    MODES,
    defaultBlock,
    getActiveBlocks,
    buildTimeline,
    createStateFromConfig,
  };
});
