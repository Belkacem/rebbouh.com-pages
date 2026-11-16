(() => {
  const storageKey = "rebbouh-theme";
  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const validTheme = (value) => value === "light" || value === "dark";
  let preference = null;
  let button;

  try {
    const saved = localStorage.getItem(storageKey);
    if (validTheme(saved)) preference = saved;
  } catch {
    // The toggle still works when browser storage is unavailable.
  }

  function applyTheme() {
    const theme = preference || (systemTheme.matches ? "dark" : "light");
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content", theme === "dark" ? "#1b1c19" : "#f5f1e8",
    );
    if (button) {
      const next = theme === "dark" ? "light" : "dark";
      const action = button.dataset[`${next}Action`];
      button.querySelector(".theme-label").textContent = button.dataset[`${next}Label`];
      button.setAttribute("aria-label", action);
      button.title = action;
    }
  }

  // Apply the saved choice before styles paint to avoid a flash of the wrong theme.
  applyTheme();
  systemTheme.addEventListener("change", () => {
    if (!preference) applyTheme();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    preference = validTheme(event.newValue) ? event.newValue : null;
    applyTheme();
  });

  document.addEventListener("DOMContentLoaded", () => {
    button = document.querySelector(".theme-toggle");
    if (button) {
      applyTheme();
      button.hidden = false;
      button.addEventListener("click", () => {
        preference = root.dataset.theme === "dark" ? "light" : "dark";
        try {
          localStorage.setItem(storageKey, preference);
        } catch {
          // Keep the choice for this page even if it cannot be persisted.
        }
        applyTheme();
      });
    }

    // Keep the section when changing language. Navigation also works without JS.
    document.querySelectorAll(".language a").forEach((link) => {
      link.addEventListener("click", () => {
        link.hash = window.location.hash;
      });
    });
  });
})();
