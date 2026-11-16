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

    const flow = document.querySelector(".agent-flow");
    if (flow) {
      const play = flow.querySelector(".flow-play");
      const label = play.querySelector(".flow-play-label");
      const workers = [...flow.querySelectorAll(".agent-worker")];
      const announcement = flow.querySelector(".flow-announcement");
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let timers = [];

      function assign(worker) {
        worker.classList.add("is-assigned");
        worker.querySelector(".agent-assignment").textContent = flow.dataset.assigned;
      }
      function finish() {
        timers.forEach(clearTimeout);
        timers = [];
        workers.forEach(assign);
        flow.classList.remove("is-distributing");
        label.textContent = flow.dataset.replay;
        play.disabled = false;
        announcement.textContent = flow.dataset.complete;
      }

      workers.forEach((worker) => {
        const status = worker.querySelector(".agent-assignment");
        status.hidden = false;
        status.textContent = flow.dataset.pending;
      });
      play.hidden = false;
      play.addEventListener("click", () => {
        if (play.disabled) return;
        play.disabled = true;
        label.textContent = flow.dataset.running;
        announcement.textContent = "";
        workers.forEach((worker) => {
          worker.classList.remove("is-assigned");
          worker.querySelector(".agent-assignment").textContent = flow.dataset.pending;
        });
        if (reducedMotion.matches) {
          finish();
          return;
        }
        flow.classList.add("is-distributing");
        workers.forEach((worker, index) => {
          timers.push(setTimeout(() => assign(worker), 1000 + index * 400));
        });
        timers.push(setTimeout(finish, 2200));
      });
      reducedMotion.addEventListener("change", () => {
        if (reducedMotion.matches && play.disabled) finish();
      });
    }
  });
})();
