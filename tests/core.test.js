const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  BLOCKS,
  defaultBlock,
  defaultExercise,
  isExerciseActive,
  getActiveBlocks,
  buildTimeline,
  createStateFromConfig,
  normalizeExercise,
} = require("../core.js");

function makeState(overrides = {}) {
  const state = {
    restBetweenBlocks: 60,
    blocks: {},
  };
  BLOCKS.forEach((b) => {
    state.blocks[b] = defaultBlock();
  });
  return Object.assign(state, overrides);
}

function wodBlock(config) {
  return makeState({
    blocks: {
      alongamento: defaultBlock(),
      tecnica: defaultBlock(),
      wod: { ...defaultBlock(), ...config },
    },
  });
}

describe("isExerciseActive", () => {
  it("aceita exercício só com nome", () => {
    assert.equal(isExerciseActive({ name: "Burpee", reps: "" }), true);
  });

  it("aceita exercício só com reps", () => {
    assert.equal(isExerciseActive({ name: "", reps: "10" }), true);
  });

  it("ignora linha só com pesos", () => {
    assert.equal(isExerciseActive({ name: "", reps: "", weightM: "95 lb", weightF: "65 lb" }), false);
  });
});

describe("getActiveBlocks", () => {
  it("ignora blocos sem exercícios nomeados", () => {
    const state = makeState();
    assert.equal(getActiveBlocks(state).length, 0);

    state.blocks.wod.exercises = [{ name: "Burpee", reps: "10" }];
    assert.equal(getActiveBlocks(state).length, 1);
    assert.equal(getActiveBlocks(state)[0].key, "wod");
  });

  it("aceita exercício apenas com reps (pesos opcionais)", () => {
    const state = makeState();
    state.blocks.wod.exercises = [{ name: "", reps: "21-15-9", weightM: "", weightF: "" }];
    const active = getActiveBlocks(state);
    assert.equal(active.length, 1);
    assert.equal(active[0].config.exercises[0].name, "21-15-9");
    assert.equal(buildTimeline(state).length, 1);
  });
});

describe("Tabata", () => {
  it("alterna exercícios a cada round de trabalho", () => {
    const state = wodBlock({
      mode: "tabata",
      tabataRounds: 4,
      exercises: [
        { name: "Burpee", reps: "10" },
        { name: "Air Squat", reps: "15" },
      ],
    });

    const work = buildTimeline(state).filter((p) => p.type === "work" && p.mode === "tabata");
    assert.deepEqual(
      work.map((p) => p.exercise.name),
      ["Burpee", "Air Squat", "Burpee", "Air Squat"]
    );
    assert.deepEqual(work.map((p) => p.exerciseIndex), [0, 1, 0, 1]);
  });

  it("repete o mesmo exercício quando há apenas um", () => {
    const state = wodBlock({
      mode: "tabata",
      tabataRounds: 3,
      exercises: [{ name: "Push-up", reps: "20" }],
    });

    const work = buildTimeline(state).filter((p) => p.type === "work");
    assert.equal(work.length, 3);
    assert.ok(work.every((p) => p.exercise.name === "Push-up"));
  });

  it("intercala trabalho 20s e descanso 10s", () => {
    const state = wodBlock({
      mode: "tabata",
      tabataRounds: 2,
      exercises: [{ name: "Row", reps: "max" }],
    });

    const phases = buildTimeline(state).filter((p) => p.mode === "tabata");
    assert.deepEqual(
      phases.map((p) => `${p.type}:${p.duration}`),
      ["work:20", "rest:10", "work:20"]
    );
  });
});

describe("EMOM", () => {
  it("cicla exercícios a cada intervalo", () => {
    const state = wodBlock({
      mode: "emom",
      totalMinutes: 3,
      intervalSeconds: 60,
      exercises: [
        { name: "A", reps: "1" },
        { name: "B", reps: "2" },
        { name: "C", reps: "3" },
      ],
    });

    const work = buildTimeline(state).filter((p) => p.mode === "emom");
    assert.deepEqual(work.map((p) => p.exercise.name), ["A", "B", "C"]);
  });
});

describe("Sequencial", () => {
  it("inclui descanso entre exercícios", () => {
    const state = wodBlock({
      mode: "sequential",
      workSeconds: 30,
      restSeconds: 10,
      exercises: [
        { name: "Ex1", reps: "5" },
        { name: "Ex2", reps: "5" },
      ],
    });

    const phases = buildTimeline(state);
    assert.deepEqual(
      phases.map((p) => p.type),
      ["work", "rest", "work"]
    );
  });
});

describe("Controle remoto (payload de config)", () => {
  it("monta timeline Tabata alternada a partir do payload enviado", () => {
    const payload = {
      restBetweenBlocks: 0,
      blocks: {
        alongamento: defaultBlock(),
        tecnica: defaultBlock(),
        wod: {
          ...defaultBlock(),
          mode: "tabata",
          tabataRounds: 4,
          exercises: [
            { name: "KB Swing", reps: "20" },
            { name: "Box Jump", reps: "10" },
          ],
        },
      },
    };

    const state = createStateFromConfig(payload);
    const work = buildTimeline(state).filter((p) => p.type === "work");
    assert.deepEqual(work.map((p) => p.exercise.name), ["KB Swing", "Box Jump", "KB Swing", "Box Jump"]);
  });

  it("preserva blocos vazios no state remoto", () => {
    const payload = {
      blocks: {
        wod: {
          mode: "amrap",
          timeCapMinutes: 12,
          exercises: [{ name: "Wall Ball", reps: "20" }],
        },
      },
    };

    const state = createStateFromConfig(payload);
    assert.equal(state.blocks.alongamento.mode, "sequential");
    assert.equal(getActiveBlocks(state).length, 1);
    assert.equal(buildTimeline(state)[0].label, "AMRAP");
  });
});

describe("defaultExercise", () => {
  it("inclui campos de peso masculino e feminino", () => {
    const ex = defaultExercise();
    assert.equal(ex.weightM, "");
    assert.equal(ex.weightF, "");
  });

  it("preserva pesos ao normalizar", () => {
    const ex = normalizeExercise({ name: "Clean", reps: "5", weightM: "135", weightF: "95" });
    assert.equal(ex.weightM, "135");
    assert.equal(ex.weightF, "95");
  });
});

describe("Descanso entre blocos", () => {
  it("insere pausa entre alongamento e wod", () => {
    const state = makeState({ restBetweenBlocks: 45 });
    state.blocks.alongamento.exercises = [{ name: "Mobility", reps: "1" }];
    state.blocks.wod.exercises = [{ name: "Fran", reps: "21-15-9" }];
    state.blocks.wod.mode = "fortime";

    const phases = buildTimeline(state);
    assert.equal(phases.length, 3);
    assert.equal(phases[1].type, "rest");
    assert.equal(phases[1].duration, 45);
    assert.equal(phases[1].betweenBlocks, true);
  });
});
