(function () {
  "use strict";

  const THEMES = [
    { id: "dark", label: "Escuro", icon: "🌙" },
    { id: "light", label: "Claro", icon: "☀️" },
    { id: "neon", label: "Neon", icon: "⚡" },
    { id: "amber", label: "Âmbar", icon: "🔥" },
    { id: "ocean", label: "Oceano", icon: "🌊" },
  ];

  const STORAGE_KEY = "wod-theme";

  function getThemeIndex(id) {
    const i = THEMES.findIndex((t) => t.id === id);
    return i >= 0 ? i : 0;
  }

  function applyTheme(id) {
    const theme = THEMES[getThemeIndex(id)];
    document.documentElement.setAttribute("data-theme", theme.id);
    sessionStorage.setItem(STORAGE_KEY, theme.id);
    document.querySelectorAll(".btn-theme").forEach((btn) => {
      btn.textContent = theme.icon;
      btn.title = `Tema: ${theme.label} (toque para alternar)`;
      btn.setAttribute("aria-label", `Tema ${theme.label}. Toque para alternar.`);
    });
    return theme;
  }

  function cycleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = THEMES[(getThemeIndex(current) + 1) % THEMES.length];
    return applyTheme(next.id);
  }

  function initTheme() {
    let saved = "dark";
    try {
      saved = sessionStorage.getItem(STORAGE_KEY) || "dark";
    } catch (_) { /* ignore */ }
    applyTheme(saved);

    document.querySelectorAll(".btn-theme").forEach((btn) => {
      btn.addEventListener("click", cycleTheme);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
  } else {
    initTheme();
  }

  window.WodTheme = { applyTheme, cycleTheme, THEMES };
})();
