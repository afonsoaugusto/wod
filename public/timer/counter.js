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

  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    return audioCtx;
  }

  /** Deve rodar de forma síncrona dentro do clique/toque (Safari/iOS). */
  function unlockAudioInGesture() {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (_) { /* ignore */ }

    const el = $("#audio-unlock");
    if (el) {
      el.volume = 0.01;
      el.play().catch(() => {});
    }

    return true;
  }

  function ensureAudioReady() {
    const ctx = getAudioContext();
    if (!ctx) return null;
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    return ctx;
  }

  function playTone({ freq, duration, volume = 0.3, type = "sine", freqEnd, delay = 0 }) {
    const ctx = ensureAudioReady();
    if (!ctx) return;

    try {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + duration);
      }
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    } catch (_) { /* ignore */ }
  }

  function soundIncrement() {
    playTone({ freq: 880, duration: 0.07, volume: 0.2, type: "sine" });
  }

  function soundDecrement() {
    playTone({ freq: 520, duration: 0.07, volume: 0.2, type: "sine" });
  }

  function soundStart() {
    playTone({ freq: 1400, freqEnd: 3200, duration: 0.32, volume: 0.38, type: "sine" });
    playTone({ freq: 2200, duration: 0.12, volume: 0.22, type: "triangle", delay: 0.28 });
  }

  function soundPause() {
    playTone({ freq: 900, freqEnd: 400, duration: 0.18, volume: 0.28, type: "triangle" });
  }

  function soundContinue() {
    playTone({ freq: 700, freqEnd: 1400, duration: 0.2, volume: 0.28, type: "sine" });
  }

  function soundFinished() {
    playTone({ freq: 2600, freqEnd: 700, duration: 0.28, volume: 0.4, type: "square", delay: 0 });
    playTone({ freq: 2000, freqEnd: 500, duration: 0.35, volume: 0.38, type: "square", delay: 0.32 });
  }

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
        const prevStatus = countdown.status;
        countdown = tickCountdown(countdown);
        renderCountdown();
        if (prevStatus === "running" && countdown.status === "finished") {
          soundFinished();
        }
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
      unlockAudioInGesture();
      state = incrementCounter(state);
      renderCounter();
      soundIncrement();
    });

    $("#btn-decrement").addEventListener("click", () => {
      unlockAudioInGesture();
      state = decrementCounter(state);
      renderCounter();
      soundDecrement();
    });

    $("#btn-reset").addEventListener("click", () => {
      state = resetCounter();
      renderCounter();
    });

    minutesInput.addEventListener("change", applyConfiguredDuration);
    secondsInput.addEventListener("change", applyConfiguredDuration);

    toggleBtn.addEventListener("click", () => {
      unlockAudioInGesture();
      const prevStatus = countdown.status;
      if (prevStatus === "idle" || prevStatus === "finished") {
        applyConfiguredDuration();
      }
      countdown = toggleCountdown(countdown);
      renderCountdown();
      ensureTicker();

      if (countdown.status === "running") {
        if (prevStatus === "paused") soundContinue();
        else soundStart();
      } else if (countdown.status === "paused") {
        soundPause();
      }
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
