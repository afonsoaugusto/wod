const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  loadWorkoutsSync,
  parseWorkoutTemplate,
  estimateDuration,
  formatDuration,
  formatClockTime,
  serializeConfig,
  createStateFromConfig,
  normalizeExercise,
  buildTimeline,
  defaultBlockEntry,
} = require("../public/timer/core.js");

const CLASSIC_TEMPLATES = loadWorkoutsSync();

describe("workouts/*.json", () => {
  it("inclui benchmarks clássicos (Girls, Heroes)", () => {
    const names = CLASSIC_TEMPLATES.map((t) => t.id);
    ["cindy", "fran", "grace", "helen", "diane", "elizabeth", "isabel", "murph", "chelsea", "karen"].forEach(
      (id) => assert.ok(names.includes(id), `falta template ${id}`)
    );
    assert.ok(CLASSIC_TEMPLATES.length >= 15);
  });

  it("marca treinos padrão com classic: true", () => {
    const murph = CLASSIC_TEMPLATES.find((t) => t.id === "murph");
    assert.equal(murph.classic, true);
    assert.match(murph.name, /Murph/);
  });

  it("parseWorkoutTemplate valida id e name", () => {
    assert.throws(() => parseWorkoutTemplate({ name: "X" }), /id and name/);
  });

  it("Cindy gera timeline AMRAP com time cap de 20 min", () => {
    const cindy = CLASSIC_TEMPLATES.find((t) => t.id === "cindy");
    const state = createStateFromConfig(cindy.config);
    const timeline = buildTimeline(state);
    assert.equal(timeline.length, 1);
    assert.equal(timeline[0].mode, "amrap");
    assert.equal(timeline[0].duration, 20 * 60);
    assert.equal(timeline[0].exercises.length, 3);
  });

  it("Murph inclui pesos sugeridos M/F no colete", () => {
    const murph = CLASSIC_TEMPLATES.find((t) => t.id === "murph");
    const wod = murph.config.blockList[0];
    const pullup = wod.exercises.find((e) => e.name === "Pull-up");
    assert.equal(pullup.weightM, "20 lb vest");
    assert.equal(pullup.weightF, "14 lb vest");
  });

  it("Fran inclui pesos de thruster", () => {
    const fran = CLASSIC_TEMPLATES.find((t) => t.id === "fran");
    const thruster = fran.config.blockList[0].exercises[0];
    assert.equal(thruster.weightM, "95 lb");
    assert.equal(thruster.weightF, "65 lb");
  });

  it("Chelsea usa EMOM de 30 minutos", () => {
    const chelsea = CLASSIC_TEMPLATES.find((t) => t.id === "chelsea");
    const wod = chelsea.config.blockList[0];
    assert.equal(wod.mode, "emom");
    assert.equal(wod.totalMinutes, 30);
    assert.equal(buildTimeline(createStateFromConfig(chelsea.config)).length, 30);
  });
});

describe("estimateDuration", () => {
  it("soma blocos sequenciais e descanso entre blocos", () => {
    const state = createStateFromConfig({
      restBetweenBlocks: 60,
      blockList: [
        {
          ...defaultBlockEntry("alongamento"),
          mode: "sequential",
          workSeconds: 30,
          restSeconds: 10,
          exercises: [
            { name: "A", reps: "1" },
            { name: "B", reps: "1" },
          ],
        },
        {
          ...defaultBlockEntry("wod"),
          mode: "amrap",
          timeCapMinutes: 12,
          exercises: [{ name: "Burpee", reps: "10" }],
        },
      ],
    });
    assert.equal(estimateDuration(state), 70 + 60 + 720);
    assert.equal(formatDuration(850), "14 min 10s");
  });

  it("retorna sem limite para For Time sem time cap", () => {
    const state = createStateFromConfig({
      blockList: [
        {
          ...defaultBlockEntry("wod"),
          mode: "fortime",
          timeCapMinutes: 0,
          exercises: [{ name: "Fran", reps: "21-15-9" }],
        },
      ],
    });
    assert.equal(formatDuration(estimateDuration(state)), "sem limite");
  });
});

describe("serializeConfig e exercícios com peso", () => {
  it("normaliza campos de peso M/F", () => {
    const ex = normalizeExercise({ name: "Thruster", reps: "21", weightM: "95 lb" });
    assert.equal(ex.weightM, "95 lb");
    assert.equal(ex.weightF, "");
  });

  it("serializa weightUnit no config", () => {
    const state = {
      blockList: [defaultBlockEntry("wod")],
      restBetweenBlocks: 60,
      weightUnit: "kg",
      layoutRatio: 55,
      soundEnabled: true,
      prepSeconds: 5,
    };
    const serialized = serializeConfig(state);
    assert.equal(serialized.weightUnit, "kg");
    assert.equal(serialized.layoutRatio, 55);
    assert.ok(Array.isArray(serialized.blockList));
  });
});

describe("formatClockTime", () => {
  it("formata segundos como MM:SS", () => {
    assert.equal(formatClockTime(0), "00:00");
    assert.equal(formatClockTime(65), "01:05");
    assert.equal(formatClockTime(3723), "62:03");
  });
});
