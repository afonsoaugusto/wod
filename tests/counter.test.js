const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeCount,
  createCounter,
  incrementCounter,
  decrementCounter,
  resetCounter,
  createCountdown,
  setCountdownDuration,
  startCountdown,
  pauseCountdown,
  toggleCountdown,
  stopCountdown,
  tickCountdown,
  countdownLabel,
  formatClockTime,
} = require("../public/timer/core.js");

describe("normalizeCount", () => {
  it("converte strings e floats para inteiro", () => {
    assert.equal(normalizeCount("12"), 12);
    assert.equal(normalizeCount(3.9), 3);
  });

  it("trata valores inválidos como zero", () => {
    assert.equal(normalizeCount(undefined), 0);
    assert.equal(normalizeCount(null), 0);
    assert.equal(normalizeCount("abc"), 0);
    assert.equal(normalizeCount(NaN), 0);
  });
});

describe("createCounter", () => {
  it("inicia em zero por padrão", () => {
    assert.deepEqual(createCounter(), { value: 0 });
  });

  it("aceita valor inicial", () => {
    assert.deepEqual(createCounter(7), { value: 7 });
  });
});

describe("incrementCounter / decrementCounter", () => {
  it("incrementa e decrementa em 1 por padrão", () => {
    let state = createCounter(5);
    state = incrementCounter(state);
    assert.equal(state.value, 6);
    state = decrementCounter(state);
    assert.equal(state.value, 5);
  });

  it("aceita passo customizado", () => {
    assert.equal(incrementCounter(createCounter(1), 3).value, 4);
    assert.equal(decrementCounter(createCounter(10), 4).value, 6);
  });

  it("permite valores negativos", () => {
    assert.equal(decrementCounter(createCounter(0)).value, -1);
  });
});

describe("resetCounter", () => {
  it("volta para zero", () => {
    assert.deepEqual(resetCounter(), { value: 0 });
  });
});

describe("createCountdown", () => {
  it("usa 3 minutos por padrão", () => {
    const state = createCountdown();
    assert.equal(state.durationSeconds, 180);
    assert.equal(state.remainingSeconds, 180);
    assert.equal(state.status, "idle");
  });

  it("aceita duração customizada", () => {
    assert.equal(createCountdown(90).durationSeconds, 90);
  });
});

describe("countdown flow", () => {
  it("exibe MM:SS na descida", () => {
    assert.equal(formatClockTime(180), "03:00");
    assert.equal(formatClockTime(179), "02:59");
    assert.equal(formatClockTime(178), "02:58");
  });

  it("iniciar → tick → pausar → continuar → parar", () => {
    let state = createCountdown(5);
    state = startCountdown(state);
    assert.equal(state.status, "running");
    assert.equal(countdownLabel(state.status), "Pausar");

    state = tickCountdown(state);
    assert.equal(state.remainingSeconds, 4);

    state = pauseCountdown(state);
    assert.equal(state.status, "paused");
    assert.equal(countdownLabel(state.status), "Continuar");
    assert.equal(tickCountdown(state).remainingSeconds, 4);

    state = toggleCountdown(state);
    assert.equal(state.status, "running");

    state = stopCountdown(state);
    assert.equal(state.status, "idle");
    assert.equal(state.remainingSeconds, 5);
    assert.equal(countdownLabel(state.status), "Iniciar");
  });

  it("chega a finished em 00:00", () => {
    let state = startCountdown(createCountdown(1));
    state = tickCountdown(state);
    assert.equal(state.remainingSeconds, 0);
    assert.equal(state.status, "finished");
    assert.equal(formatClockTime(state.remainingSeconds), "00:00");
  });

  it("setCountdownDuration redefine o tempo configurado", () => {
    let state = startCountdown(createCountdown(60));
    state = tickCountdown(state);
    state = setCountdownDuration(state, 120);
    assert.equal(state.durationSeconds, 120);
    assert.equal(state.remainingSeconds, 120);
    assert.equal(state.status, "idle");
  });
});
