const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  calculatePlatesPerSide,
  formatPlatesList,
  buildPercentageTable,
  roundWeight,
  DEFAULT_BARS,
  PERCENTAGES,
} = require("../public/timer/core.js");

describe("calculatePlatesPerSide", () => {
  it("calcula anilhas em libras para 115 lb com barra de 45 lb", () => {
    const result = calculatePlatesPerSide(115, 45, "lb");
    assert.equal(result.perSide, 35);
    assert.deepEqual(result.plates, [35]);
    assert.equal(result.exact, true);
    assert.equal(result.achievable, 115);
  });

  it("calcula combinação de anilhas quando necessário", () => {
    const result = calculatePlatesPerSide(185, 45, "lb");
    assert.equal(result.perSide, 70);
    assert.deepEqual(result.plates, [45, 25]);
    assert.equal(result.exact, true);
  });

  it("calcula anilhas em kg para barra olímpica", () => {
    const result = calculatePlatesPerSide(100, 20, "kg");
    assert.equal(result.perSide, 40);
    assert.deepEqual(result.plates, [25, 15]);
    assert.equal(result.exact, true);
  });

  it("retorna vazio quando peso alvo não excede a barra", () => {
    const result = calculatePlatesPerSide(40, 45, "lb");
    assert.equal(result.perSide, 0);
    assert.deepEqual(result.plates, []);
  });
});

describe("formatPlatesList", () => {
  it("agrupa anilhas repetidas", () => {
    const text = formatPlatesList([45, 25, 10, 10], "lb");
    assert.equal(text, "45 + 25 + 2×10 lb");
  });
});

describe("buildPercentageTable", () => {
  it("gera linhas para todos os percentuais padrão", () => {
    const rows = buildPercentageTable(200, 45, "lb", PERCENTAGES);
    assert.equal(rows.length, PERCENTAGES.length);
    assert.equal(rows[0].percent, 50);
    assert.equal(rows[0].targetWeight, 100);
    assert.equal(rows[rows.length - 1].percent, 110);
    assert.equal(rows[rows.length - 1].targetWeight, 220);
  });

  it("usa barra padrão quando não informada", () => {
    const calc = calculatePlatesPerSide(100, DEFAULT_BARS.lb, "lb");
    assert.equal(calc.barWeight, 45);
  });
});

describe("roundWeight", () => {
  it("arredonda em incrementos de meia libra", () => {
    assert.equal(roundWeight(115.2, "lb"), 115);
    assert.equal(roundWeight(115.3, "lb"), 115.5);
  });

  it("arredonda em incrementos de 0.25 kg", () => {
    assert.equal(roundWeight(60.1, "kg"), 60);
    assert.equal(roundWeight(60.2, "kg"), 60.25);
  });
});
