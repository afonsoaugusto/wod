const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  BLOCKS,
  defaultBlock,
  defaultBlockEntry,
  defaultExercise,
  isExerciseActive,
  getActiveBlocks,
  buildTimeline,
  createStateFromConfig,
  normalizeExercise,
} = require("../core.js");

function makeState(overrides = {}) {
  return Object.assign(
    {
      restBetweenBlocks: 60,
      blockList: [],
    },
    overrides
  );
}

function wodBlock(config) {
  return makeState({
    blockList: [
      {
        ...defaultBlockEntry("wod"),
        ...config,
        exercises: config.exercises || [],
      },
    ],
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
    const state = makeState({ blockList: [defaultBlockEntry("wod")] });
    assert.equal(getActiveBlocks(state).length, 0);

    state.blockList[0].exercises = [{ name: "Burpee", reps: "10" }];
    assert.equal(getActiveBlocks(state).length, 1);
    assert.equal(getActiveBlocks(state)[0].category, "wod");
  });

  it("aceita exercício apenas com reps (pesos opcionais)", () => {
    const state = makeState({
      blockList: [
        {
          ...defaultBlockEntry("wod"),
          exercises: [{ name: "", reps: "21-15-9", weightM: "", weightF: "" }],
        },
      ],
    });
    const active = getActiveBlocks(state);
    assert.equal(active.length, 1);
    assert.equal(active[0].config.exercises[0].name, "21-15-9");
    assert.equal(buildTimeline(state).length, 1);
  });

  it("permite vários blocos do mesmo tipo", () => {
    const state = makeState({
      blockList: [
        { ...defaultBlockEntry("tecnica"), exercises: [{ name: "Skill A", reps: "5" }] },
        { ...defaultBlockEntry("tecnica"), exercises: [{ name: "Skill B", reps: "5" }] },
      ],
    });
    const active = getActiveBlocks(state);
    assert.equal(active.length, 2);
    assert.equal(active[0].label, "Técnica");
    assert.equal(active[1].label, "Técnica");
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
    assert.deepEqual(work.map((p) => p.exercise.name), ["Burpee", "Air Squat", "Burpee", "Air Squat"]);
  });

  it("repete o mesmo exercício quando há apenas um", () => {
    const state = wodBlock({
      mode: "tabata",
      tabataRounds: 3,
      exercises: [{ name: "Burpee", reps: "10" }],
    });
    const work = buildTimeline(state).filter((p) => p.type === "work");
    assert.equal(work.length, 3);
    assert.ok(work.every((p) => p.exercise.name === "Burpee"));
  });

  it("intercala trabalho 20s e descanso 10s", () => {
    const state = wodBlock({
      mode: "tabata",
      tabataRounds: 2,
      exercises: [{ name: "Burpee", reps: "10" }],
    });
    const phases = buildTimeline(state);
    assert.equal(phases.length, 3);
    assert.equal(phases[0].duration, 20);
    assert.equal(phases[1].type, "rest");
    assert.equal(phases[1].duration, 10);
    assert.equal(phases[2].duration, 20);
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
        { name: "B", reps: "1" },
      ],
    });
    const work = buildTimeline(state);
    assert.equal(work.length, 3);
    assert.deepEqual(work.map((p) => p.exercise.name), ["A", "B", "A"]);
  });
});

describe("Sequencial", () => {
  it("inclui descanso entre exercícios", () => {
    const state = wodBlock({
      mode: "sequential",
      workSeconds: 30,
      restSeconds: 10,
      exercises: [
        { name: "A", reps: "1" },
        { name: "B", reps: "1" },
      ],
    });
    const phases = buildTimeline(state);
    assert.equal(phases.length, 3);
    assert.equal(phases[1].type, "rest");
    assert.equal(phases[1].duration, 10);
  });
});

describe("Controle remoto (payload de config)", () => {
  it("monta timeline Tabata alternada a partir do payload enviado", () => {
    const payload = {
      restBetweenBlocks: 0,
      blockList: [
        {
          ...defaultBlockEntry("wod"),
          mode: "tabata",
          tabataRounds: 4,
          exercises: [
            { name: "KB Swing", reps: "20" },
            { name: "Box Jump", reps: "10" },
          ],
        },
      ],
    };

    const state = createStateFromConfig(payload);
    const work = buildTimeline(state).filter((p) => p.type === "work");
    assert.deepEqual(work.map((p) => p.exercise.name), ["KB Swing", "Box Jump", "KB Swing", "Box Jump"]);
  });

  it("migra formato legado blocks para blockList", () => {
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
    assert.equal(state.blockList.length, 1);
    assert.equal(state.blockList[0].category, "wod");
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
  it("insere pausa entre blocos ativos na ordem", () => {
    const state = makeState({
      restBetweenBlocks: 45,
      blockList: [
        { ...defaultBlockEntry("alongamento"), exercises: [{ name: "Mobility", reps: "1" }] },
        {
          ...defaultBlockEntry("wod"),
          mode: "fortime",
          exercises: [{ name: "Fran", reps: "21-15-9" }],
        },
      ],
    });

    const phases = buildTimeline(state);
    assert.equal(phases.length, 3);
    assert.equal(phases[1].type, "rest");
    assert.equal(phases[1].duration, 45);
    assert.equal(phases[1].betweenBlocks, true);
  });
});
