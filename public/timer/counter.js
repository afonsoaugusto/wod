(function () {
  "use strict";

  const { createCounter, incrementCounter, decrementCounter, resetCounter } = WodCore;

  const STORAGE_KEY = "wod-counter";

  const $ = (sel) => document.querySelector(sel);

  function loadCount() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved == null) return 0;
      return createCounter(saved).value;
    } catch (_) {
      return 0;
    }
  }

  function saveCount(value) {
    localStorage.setItem(STORAGE_KEY, String(value));
  }

  function init() {
    let state = createCounter(loadCount());
    const valueEl = $("#counter-value");

    function render() {
      valueEl.textContent = String(state.value);
      saveCount(state.value);
    }

    $("#btn-increment").addEventListener("click", () => {
      state = incrementCounter(state);
      render();
    });

    $("#btn-decrement").addEventListener("click", () => {
      state = decrementCounter(state);
      render();
    });

    $("#btn-reset").addEventListener("click", () => {
      state = resetCounter();
      render();
    });

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
