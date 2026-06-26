(function () {
  "use strict";

  const {
    WEIGHT_UNITS,
    DEFAULT_BARS,
    PERCENTAGES,
    calculatePlatesPerSide,
    formatPlatesList,
    buildPercentageTable,
    roundWeight,
  } = WodCore;

  const STORAGE_KEY = "wod-bar-calc";

  const $ = (sel) => document.querySelector(sel);

  function loadPrefs() {
    const defaults = { unit: "lb", barWeight: DEFAULT_BARS.lb, baseWeight: 225, targetWeight: 115 };
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return defaults;
      const parsed = { ...defaults, ...JSON.parse(saved) };
      if (!parsed.baseWeight || parsed.baseWeight <= 0) parsed.baseWeight = 225;
      return parsed;
    } catch (_) {
      return defaults;
    }
  }

  function savePrefs(prefs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }

  function renderResult(container, calc) {
    if (calc.totalWeight <= calc.barWeight) {
      container.innerHTML = `<p class="calc-hint">O peso alvo deve ser maior que o peso da barra.</p>`;
      return;
    }

    const platesText = formatPlatesList(calc.plates, calc.unit);
    const exactNote = calc.exact
      ? ""
      : `<p class="calc-warning">Peso mais próximo: <strong>${calc.achievable} ${calc.unit}</strong> (resto ${calc.remainder} ${calc.unit}/lado)</p>`;

    container.innerHTML = `
      <div class="calc-result-card">
        <p class="calc-result-main">Cada lado: <strong>${calc.perSide} ${calc.unit}</strong></p>
        <p class="calc-result-plates">${platesText}</p>
        ${exactNote}
      </div>`;
  }

  function renderTable(tbody, baseWeight, barWeight, unit) {
    if (!tbody) return;

    if (!baseWeight || baseWeight <= barWeight) {
      tbody.innerHTML = `<tr class="calc-table-empty"><td colspan="4">Informe um peso de referência maior que a barra para ver a tabela.</td></tr>`;
      return;
    }

    const rows = buildPercentageTable(baseWeight, barWeight, unit, PERCENTAGES);
    tbody.innerHTML = rows
      .map((row) => {
        const plates = formatPlatesList(row.plates, unit);
        const note = row.exact ? "" : ` (~${row.achievable})`;
        const sideLabel = row.perSide > 0 ? `${row.perSide} ${unit}` : "—";
        return `<tr>
          <td>${row.percent}%</td>
          <td>${row.targetWeight} ${unit}${note}</td>
          <td>${sideLabel}</td>
          <td>${plates}</td>
        </tr>`;
      })
      .join("");
  }

  function applyUnit(unit) {
    const barInput = $("#bar-weight");
    const baseInput = $("#base-weight");
    const targetInput = $("#target-weight");
    const defaultBar = DEFAULT_BARS[unit] ?? DEFAULT_BARS.lb;

    $("#unit-label-bar").textContent = unit;
    $("#unit-label-target").textContent = unit;
    $("#unit-label-base").textContent = unit;
    $("#table-unit-hint").textContent = unit;

    if (!barInput.dataset.touched) {
      barInput.value = defaultBar;
    }

    [baseInput, targetInput, barInput].forEach((el) => {
      if (el) el.step = unit === "kg" ? "0.25" : "0.5";
    });
  }

  function recalc() {
    const unit = $("#weight-unit").value;
    const barWeight = +$("#bar-weight").value || DEFAULT_BARS[unit];
    const targetWeight = +$("#target-weight").value || 0;
    const baseWeight = +$("#base-weight").value || 0;

    savePrefs({ unit, barWeight, baseWeight, targetWeight });

    const calc = calculatePlatesPerSide(targetWeight, barWeight, unit);
    renderResult($("#calc-result"), calc);
    renderTable($("#percent-table tbody"), baseWeight, barWeight, unit);
  }

  function init() {
    const prefs = loadPrefs();

    const unitSelect = $("#weight-unit");
    unitSelect.innerHTML = WEIGHT_UNITS.map(
      (u) => `<option value="${u.value}" ${prefs.unit === u.value ? "selected" : ""}>${u.label}</option>`
    ).join("");

    $("#bar-weight").value = prefs.barWeight;
    $("#target-weight").value = prefs.targetWeight ?? "";
    $("#base-weight").value = prefs.baseWeight;

    unitSelect.addEventListener("change", () => {
      applyUnit(unitSelect.value);
      recalc();
    });

    $("#bar-weight").addEventListener("input", () => {
      $("#bar-weight").dataset.touched = "1";
      recalc();
    });

    ["#target-weight", "#base-weight"].forEach((sel) => {
      $(sel)?.addEventListener("input", recalc);
    });

    $("#btn-set-bar-male")?.addEventListener("click", () => {
      const unit = unitSelect.value;
      $("#bar-weight").value = DEFAULT_BARS[unit];
      $("#bar-weight").dataset.touched = "1";
      recalc();
    });

    $("#btn-set-bar-female")?.addEventListener("click", () => {
      const unit = unitSelect.value;
      $("#bar-weight").value = unit === "kg" ? 15 : 35;
      $("#bar-weight").dataset.touched = "1";
      recalc();
    });

    applyUnit(prefs.unit);
    recalc();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
