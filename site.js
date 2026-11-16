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
      const icon = play.querySelector(".flow-control-icon");
      const workers = [...flow.querySelectorAll(".agent-worker")];
      const manager = flow.querySelector(".agent-manager");
      const mission = flow.querySelector(".agent-mission");
      const managerResultLabel = flow.querySelector(".manager-result-label");
      const managerResultText = flow.querySelector(".manager-result-text");
      const counter = flow.querySelector(".flow-scenario-count");
      const state = flow.querySelector(".flow-state");
      const phase = flow.querySelector(".flow-phase");
      const announcement = flow.querySelector(".flow-announcement");
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let scenarios;
      try {
        scenarios = JSON.parse(flow.querySelector(".agent-scenarios").textContent);
      } catch {
        return; // Keep the static diagram if its optional scenario data is unavailable.
      }
      if (!Array.isArray(scenarios) || !scenarios.length || !scenarios.every((scenario) =>
        typeof scenario.mission === "string" && typeof scenario.synthesis === "string" && Array.isArray(scenario.agents) &&
        scenario.agents.length === workers.length && scenario.agents.every((agent) =>
          typeof agent.role === "string" && typeof agent.task === "string" && typeof agent.result === "string"))) return;

      const checkpoints = [
        ...workers.map((_, index) => ({ at: 1000 + index * 400, action: "assign", index })),
        { at: 2200, action: "working" },
        { at: 4300, action: "returning" },
        ...workers.map((_, index) => ({ at: 5300 + index * 400, action: "receive", index })),
        { at: 6500, action: "synthesise" },
        { at: 11500, action: "next" },
      ];
      let scenarioIndex = 0;
      let checkpoint = 0;
      let elapsed = 0;
      let resumedAt = 0;
      let timer = null;
      let running = false;
      let started = false;
      let userPaused = false;
      let manualStart = false;
      let managerReached = false;
      let inViewport = !("IntersectionObserver" in window);
      let arrivalObserver;

      function updateControls() {
        const action = running ? flow.dataset.pause : started ? flow.dataset.resume : flow.dataset.start;
        label.textContent = action;
        icon.textContent = running ? "Ⅱ" : "▶";
        play.setAttribute("aria-label", action);
        flow.dataset.playback = running ? "playing" : started ? "paused" : "idle";
        if (state) state.textContent = running ? flow.dataset.running : started ? flow.dataset.paused : flow.dataset.pending;
      }
      function assign(worker) {
        worker.classList.add("is-assigned");
        worker.querySelector(".agent-assignment").textContent = flow.dataset.assigned;
      }
      function setPhase(name) {
        flow.dataset.phase = name;
        phase.textContent = flow.dataset[`phase${name[0].toUpperCase()}${name.slice(1)}`];
      }
      function runCheckpoint(event) {
        const scenario = scenarios[scenarioIndex];
        if (event.action === "assign") {
          assign(workers[event.index]);
        } else if (event.action === "working") {
          flow.classList.remove("is-distributing");
          setPhase("working");
          workers.forEach((worker) => {
            worker.querySelector(".agent-assignment").textContent = flow.dataset.working;
          });
        } else if (event.action === "returning") {
          setPhase("returning");
          workers.forEach((worker, index) => {
            worker.classList.add("has-result");
            worker.querySelector(".agent-task-label").textContent = flow.dataset.resultLabel;
            worker.querySelector(".agent-task-text").textContent = scenario.agents[index].result;
            worker.querySelector(".agent-assignment").textContent = flow.dataset.resultReady;
          });
          managerResultLabel.textContent = flow.dataset.collecting;
          managerResultText.textContent = `0 / ${workers.length}`;
          flow.classList.add("is-returning");
        } else if (event.action === "receive") {
          workers[event.index].classList.add("is-returned");
          workers[event.index].querySelector(".agent-assignment").textContent = flow.dataset.returned;
          managerResultText.textContent = `${event.index + 1} / ${workers.length}`;
        } else if (event.action === "synthesise") {
          flow.classList.remove("is-returning");
          setPhase("synthesising");
          manager.classList.add("has-synthesis");
          managerResultLabel.textContent = flow.dataset.synthesised;
          managerResultText.textContent = scenario.synthesis;
        }
      }
      function prepareScenario() {
        const scenario = scenarios[scenarioIndex];
        mission.textContent = scenario.mission;
        manager.classList.remove("has-synthesis");
        managerResultLabel.textContent = flow.dataset.collecting;
        managerResultText.textContent = flow.dataset.waitingResults;
        workers.forEach((worker, index) => {
          worker.classList.remove("is-assigned", "has-result", "is-returned");
          worker.querySelector("h4").textContent = scenario.agents[index].role;
          worker.querySelector(".agent-task-label").textContent = flow.dataset.taskLabel;
          worker.querySelector(".agent-task-text").textContent = scenario.agents[index].task;
          const status = worker.querySelector(".agent-assignment");
          status.hidden = false;
          status.textContent = flow.dataset.pending;
        });
        counter.textContent = `${String(scenarioIndex + 1).padStart(2, "0")} / ${String(scenarios.length).padStart(2, "0")}`;
        counter.setAttribute("aria-label", `${flow.dataset.scenarioLabel} ${scenarioIndex + 1} / ${scenarios.length}`);
        elapsed = 0;
        checkpoint = 0;
        setPhase("delegating");
        flow.classList.remove("is-distributing", "is-returning");
        // Restart the route animation only when a new scenario begins.
        void flow.offsetWidth;
        flow.classList.add("is-distributing");
      }
      function clearTimer() {
        if (timer !== null) clearTimeout(timer);
        timer = null;
      }
      function scheduleNext() {
        clearTimer();
        if (!running) return;
        const currentElapsed = elapsed + performance.now() - resumedAt;
        timer = setTimeout(() => {
          timer = null;
          if (!running) return;
          elapsed += performance.now() - resumedAt;
          resumedAt = performance.now();
          while (checkpoint < checkpoints.length && elapsed >= checkpoints[checkpoint].at) {
            const event = checkpoints[checkpoint];
            if (event.action === "next") {
              scenarioIndex = (scenarioIndex + 1) % scenarios.length;
              prepareScenario();
              resumedAt = performance.now();
              break;
            }
            runCheckpoint(event);
            checkpoint += 1;
          }
          scheduleNext();
        }, Math.max(0, checkpoints[checkpoint].at - currentElapsed));
      }
      function suspend() {
        if (running) elapsed += performance.now() - resumedAt;
        running = false;
        clearTimer();
        flow.classList.add("is-paused");
      }
      function reconcile() {
        if (!started && managerReached && inViewport && !document.hidden && !reducedMotion.matches) {
          started = true;
          arrivalObserver?.disconnect();
        }
        const shouldRun = started && !userPaused && inViewport && !document.hidden &&
          (!reducedMotion.matches || manualStart);
        if (shouldRun && !running) {
          running = true;
          resumedAt = performance.now();
          flow.classList.remove("is-paused");
          scheduleNext();
        } else if (!shouldRun) {
          suspend();
        }
        updateControls();
      }

      flow.classList.add("is-paused");
      prepareScenario();
      updateControls();
      play.hidden = false;
      play.addEventListener("click", () => {
        if (running) {
          userPaused = true;
        } else {
          started = true;
          userPaused = false;
          manualStart = true;
          inViewport = true;
          arrivalObserver?.disconnect();
        }
        reconcile();
        // Autoplay remains silent to screen readers; announce explicit controls only.
        announcement.textContent = running
          ? `${flow.dataset.running} ${scenarios[scenarioIndex].mission}`
          : flow.dataset.paused;
      });
      if ("IntersectionObserver" in window) {
        arrivalObserver = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
            managerReached = true;
            inViewport = true;
            reconcile();
          }
        }, { threshold: 0.5, rootMargin: "0px 0px -48px 0px" });
        arrivalObserver.observe(manager);
        const visibilityObserver = new IntersectionObserver((entries) => {
          inViewport = entries.some((entry) => entry.isIntersecting);
          reconcile();
        }, { threshold: 0 });
        // The manager can scroll away while the employees remain visible on mobile.
        visibilityObserver.observe(flow);
      }
      document.addEventListener("visibilitychange", reconcile);
      reducedMotion.addEventListener("change", () => {
        if (reducedMotion.matches) flow.classList.remove("is-distributing", "is-returning");
        reconcile();
      });
    }
  });
})();
