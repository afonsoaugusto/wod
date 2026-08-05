const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeCount,
  createCounter,
  incrementCounter,
  decrementCounter,
  resetCounter,
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
