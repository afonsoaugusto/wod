(function () {
  "use strict";

  const {
    createCounter,
    incrementCounter,
    decrementCounter,
    resetCounter,
    createCountdown,
    setCountdownDuration,
    toggleCountdown,
    stopCountdown,
    tickCountdown,
    countdownLabel,
    formatClockTime,
  } = WodCore;

  const STORAGE_KEY = "wod-counter";
  const COUNTDOWN_STORAGE_KEY = "wod-countdown-duration";
  const DEFAULT_DURATION = 180;

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

  function loadDuration() {
    try {
      const saved = localStorage.getItem(COUNTDOWN_STORAGE_KEY);
      if (saved == null) return DEFAULT_DURATION;
      const n = Number(saved);
      return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : DEFAULT_DURATION;
    } catch (_) {
      return DEFAULT_DURATION;
    }
  }

  function saveDuration(seconds) {
    localStorage.setItem(COUNTDOWN_STORAGE_KEY, String(seconds));
  }

  function readDurationFromInputs() {
    const minutes = Math.max(0, Math.trunc(Number($("#countdown-minutes").value) || 0));
    let seconds = Math.max(0, Math.trunc(Number($("#countdown-seconds").value) || 0));
    if (seconds > 59) seconds = 59;
    return minutes * 60 + seconds;
  }

  function writeDurationToInputs(totalSeconds) {
    const sec = Math.max(0, Math.trunc(totalSeconds) || 0);
    $("#countdown-minutes").value = Math.floor(sec / 60);
    $("#countdown-seconds").value = sec % 60;
  }

  function init() {
    let state = createCounter(loadCount());
    let countdown = createCountdown(loadDuration());
    let timerId = null;

    const valueEl = $("#counter-value");
    const displayEl = $("#countdown-display");
    const toggleBtn = $("#btn-countdown-toggle");
    const stopBtn = $("#btn-countdown-stop");
    const minutesInput = $("#countdown-minutes");
    const secondsInput = $("#countdown-seconds");

    writeDurationToInputs(countdown.durationSeconds);

    function clearTick() {
      if (timerId != null) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    function renderCounter() {
      valueEl.textContent = String(state.value);
      saveCount(state.value);
    }

    function renderCountdown() {
      displayEl.textContent = formatClockTime(countdown.remainingSeconds);
      toggleBtn.textContent = countdownLabel(countdown.status);
      const locked = countdown.status === "running" || countdown.status === "paused";
      minutesInput.disabled = locked;
      secondsInput.disabled = locked;
      stopBtn.disabled = countdown.status === "idle" && countdown.remainingSeconds === countdown.durationSeconds;
    }

    function ensureTicker() {
      clearTick();
      if (countdown.status !== "running") return;
      timerId = setInterval(() => {
        countdown = tickCountdown(countdown);
        renderCountdown();
        if (countdown.status !== "running") clearTick();
      }, 1000);
    }

    function applyConfiguredDuration() {
      const duration = readDurationFromInputs();
      countdown = setCountdownDuration(countdown, duration);
      saveDuration(duration);
      writeDurationToInputs(duration);
      renderCountdown();
    }

    $("#btn-increment").addEventListener("click", () => {
      state = incrementCounter(state);
      renderCounter();
    });

    $("#btn-decrement").addEventListener("click", () => {
      state = decrementCounter(state);
      renderCounter();
    });

    $("#btn-reset").addEventListener("click", () => {
      state = resetCounter();
      renderCounter();
    });

    minutesInput.addEventListener("change", applyConfiguredDuration);
    secondsInput.addEventListener("change", applyConfiguredDuration);

    toggleBtn.addEventListener("click", () => {
      if (countdown.status === "idle" || countdown.status === "finished") {
        applyConfiguredDuration();
      }
      countdown = toggleCountdown(countdown);
      renderCountdown();
      ensureTicker();
    });

    stopBtn.addEventListener("click", () => {
      clearTick();
      countdown = stopCountdown(countdown);
      writeDurationToInputs(countdown.durationSeconds);
      renderCountdown();
    });

    renderCounter();
    renderCountdown();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
