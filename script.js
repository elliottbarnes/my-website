/* Progressive enhancement: every section and ordinary link works without JavaScript. */
(() => {
  "use strict";

  const root = document.documentElement;
  const entrance = document.getElementById("entrance");
  const workspace = document.getElementById("workspace");
  const panels = new Map(Array.from(document.querySelectorAll("[data-panel]"), (panel) => [panel.dataset.panel, panel]));
  const routes = ["about", "glassbox", "pixel-language", "architecture-lab", "automata-lab", "connect"].filter((id) => panels.has(id));
  const selectors = Array.from(document.querySelectorAll("[data-select]"));
  const themes = ["carbon", "parchment", "phosphor"];
  const dialog = document.getElementById("command-dialog");
  const commandInput = document.getElementById("command-input");
  const feedback = document.getElementById("command-feedback");
  const help = document.getElementById("keyboard-help");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let activeRoute;
  let navigationRevision = 0;
  let dialogOpener;
  let restoreDialogFocus = true;

  // Denied storage must not prevent navigation from starting.
  function readPreference(name) {
    try { return window.localStorage.getItem(`elliott:${name}`); } catch { return null; }
  }
  function savePreference(name, value) {
    try { window.localStorage.setItem(`elliott:${name}`, value); } catch { /* Session-only preferences still work. */ }
  }

  const savedTheme = readPreference("theme");
  const savedMotion = readPreference("motion");
  let theme = themes.includes(savedTheme) ? savedTheme : "carbon";
  let motionOverride = ["paused", "running"].includes(savedMotion) ? savedMotion : null;
  let motion = motionOverride || (reducedMotion?.matches ? "paused" : "running");

  function updatePreferences() {
    if (!window.PortfolioThemes) root.dataset.theme = theme;
    else theme = window.PortfolioThemes.current;
    root.dataset.motion = motion;
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", `Change theme; current theme: ${theme}`);
      button.setAttribute("title", "Select a colour theme");
    });
    document.querySelectorAll("[data-theme-label]").forEach((label) => { label.textContent = theme; });
    document.querySelectorAll("[data-motion-toggle]").forEach((button) => {
      button.setAttribute("aria-label", motion === "paused" ? "Resume animation" : "Pause animation");
      button.setAttribute("aria-pressed", String(motion === "paused"));
      button.setAttribute("title", motion === "paused" ? "Resume animation" : "Pause animation");
      if (!button.querySelector("[data-motion-label]")) button.textContent = motion === "paused" ? ":resume" : ":pause";
    });
    document.querySelectorAll("[data-motion-label]").forEach((label) => { label.textContent = motion === "paused" ? "resume" : "pause"; });
    window.dispatchEvent(new CustomEvent("portfolio:preferences", { detail: { theme, motion, reducedMotion: Boolean(reducedMotion?.matches) } }));
  }

  function setTheme(next) {
    if (window.PortfolioThemes) {
      if (!next) window.PortfolioThemes.open();
      else window.PortfolioThemes.apply(next === "carbon" ? "blackmoney" : next === "parchment" ? "whitegold" : next === "phosphor" ? "shadesofjade" : next);
      theme = window.PortfolioThemes.current;
      return;
    }
    theme = themes.includes(next) ? next : themes[(themes.indexOf(theme) + 1) % themes.length];
    savePreference("theme", theme);
    updatePreferences();
  }

  function toggleMotion() {
    motion = motion === "paused" ? "running" : "paused";
    motionOverride = motion;
    savePreference("motion", motion);
    updatePreferences();
  }

  function focusPanel(id) {
    const panel = panels.get(id);
    if (!panel) return;
    if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
    panel.focus({ preventScroll: true });
  }

  function routeFromHash() {
    const id = window.location.hash.slice(1);
    if (id === "projects" && routes.includes("about")) return "about";
    return routes.includes(id) ? id : null;
  }

  function renderRoute(id, focus = false) {
    if (!entrance || !workspace) return;
    const changed = activeRoute !== id;
    if (changed) navigationRevision += 1;
    const focusWasOnSelector = selectors.some((button) => button === document.activeElement || button.contains(document.activeElement));
    activeRoute = id;
    const entered = Boolean(id);
    root.dataset.view = entered ? "workspace" : "entrance";
    entrance.hidden = entered;
    workspace.hidden = !entered;
    panels.forEach((panel, key) => { panel.hidden = key !== id; });
    selectors.forEach((button, index) => {
      let offset = (index - routes.indexOf(id) + routes.length) % routes.length;
      if (offset > routes.length / 2) offset -= routes.length;
      button.style.setProperty("--offset", offset);
      button.dataset.distance = String(Math.abs(offset));
      const selected = button.dataset.select === id;
      button.tabIndex = selected ? 0 : -1;
      button.setAttribute("aria-pressed", String(selected));
      if (selected) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    document.querySelectorAll("[data-selected-path]").forEach((label) => {
      label.textContent = id && !["about", "connect"].includes(id) ? `~/projects/${id}` : id === "connect" ? "~/connect" : "~";
    });
    const status = document.getElementById("status-view");
    if (status) status.textContent = id || "entrance";
    if (changed) {
      const terminal = workspace.querySelector(".terminal");
      if (terminal) terminal.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      window.dispatchEvent(new CustomEvent("portfolio:view", { detail: { view: entered ? "workspace" : "entrance", panel: id } }));
      if (!focus && id && focusWasOnSelector) {
        selectors.find((button) => button.dataset.select === id)?.focus({ preventScroll: true });
      }
    }
    if (focus && changed) {
      if (id) focusPanel(id);
      else entrance.querySelector("[data-enter]")?.focus({ preventScroll: true });
    }
  }

  let entering = false;
  async function enterWorkspace() {
    if (entering) return;
    entering = true;
    const revision = navigationRevision;
    const startingHash = window.location.hash;
    try {
      await window.PortfolioAnimation?.enter();
      if (navigationRevision === revision && window.location.hash === startingHash && !activeRoute) navigate("about");
    }
    finally { entering = false; }
  }

  function navigate(id, focus = true) {
    if (id !== null && !routes.includes(id)) return;
    navigationRevision += 1;
    const hash = id ? `#${id}` : "";
    if (window.location.hash !== hash) window.location.hash = hash;
    renderRoute(id, focus);
  }

  function say(message) {
    if (feedback) feedback.textContent = message;
  }

  function openCommands() {
    if (!dialog || !commandInput || dialog.open) return;
    dialogOpener = document.activeElement;
    restoreDialogFocus = true;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    commandInput.value = "";
    say("Type a command, or choose one below.");
    commandInput.focus();
  }

  function closeCommands(restore = true) {
    if (!dialog?.open) return;
    restoreDialogFocus = restore;
    if (typeof dialog.close === "function") dialog.close();
    else {
      dialog.removeAttribute("open");
      if (restore && dialogOpener?.isConnected) dialogOpener.focus({ preventScroll: true });
    }
  }

  function runCommand(raw) {
    const command = raw.trim().toLowerCase().replace(/^[:/]\s*/, "").replace(/\s+/g, " ");
    const aliases = { whoami: "about", links: "connect", projects: "glassbox", pixel: "pixel-language", architecture: "architecture-lab", automata: "automata-lab" };
    const route = Object.hasOwn(aliases, command) ? aliases[command] : command;
    if (routes.includes(route)) {
      closeCommands(false);
      navigate(route);
      // Selecting the already-open section should still leave the dialog at a useful place.
      focusPanel(route);
      return;
    }
    if (command === "home" || command === "exit") {
      closeCommands(false);
      navigate(null);
      entrance?.querySelector("[data-enter]")?.focus({ preventScroll: true });
      return;
    } else if (["theme", "light", "dark", "theme light", "theme dark", ...themes.map((name) => `theme ${name}`)].includes(command)) {
      const requested = command.replace(/^theme\s*/, "");
      if (!requested && window.PortfolioThemes) {
        closeCommands(false);
        if (dialogOpener?.isConnected) dialogOpener.focus({ preventScroll: true });
        setTheme();
        return;
      }
      setTheme(requested === "light" ? "parchment" : requested === "dark" ? "carbon" : requested);
      say(`Theme: ${theme}.`);
    } else if (command === "motion") {
      toggleMotion();
      say(`Animation ${motion === "paused" ? "paused" : "running"}.`);
    } else if (command === "help" || command === "?") {
      if (help) help.hidden = !help.hidden;
      say("Commands: about, projects, glassbox, pixel, architecture, automata, connect, home, theme, light, dark, motion, help. Use arrow keys or j/k to browse sections; Escape returns home.");
    } else {
      say(command ? "Unknown command. Type help to see the available commands." : "Enter a command, such as about or theme.");
    }
    if (commandInput) {
      commandInput.value = "";
      commandInput.focus();
    }
  }

  document.querySelectorAll("[data-current-year]").forEach((year) => { year.textContent = String(new Date().getFullYear()); });
  if (!window.PortfolioThemes) document.querySelectorAll("[data-theme-toggle]").forEach((button) => button.addEventListener("click", () => setTheme()));
  document.querySelectorAll("[data-motion-toggle]").forEach((button) => button.addEventListener("click", toggleMotion));
  document.querySelectorAll("[data-command-open]").forEach((button) => button.addEventListener("click", openCommands));
  document.querySelectorAll("[data-command-close]").forEach((button) => button.addEventListener("click", () => closeCommands()));
  document.querySelectorAll("[data-command]").forEach((button) => button.addEventListener("click", () => runCommand(button.dataset.command)));
  document.getElementById("command-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    runCommand(commandInput?.value || "");
  });
  dialog?.addEventListener("close", () => {
    if (restoreDialogFocus && dialogOpener?.isConnected) dialogOpener.focus({ preventScroll: true });
  });

  selectors.forEach((button) => button.addEventListener("click", () => navigate(button.dataset.select, false)));
  document.querySelectorAll("[data-enter], [data-home]").forEach((link) => link.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const id = link.hasAttribute("data-home") ? null : "about";
    if (id && !routes.includes(id)) return;
    event.preventDefault();
    if (id === "about" && !activeRoute) enterWorkspace();
    else navigate(id);
  }));

  window.addEventListener("hashchange", () => {
    renderRoute(routeFromHash(), true);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  window.addEventListener("load", () => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (document.getElementById("theme-dialog")?.open) return;
    if (dialog?.open) {
      if (event.key === "Escape" && typeof dialog.close !== "function") {
        event.preventDefault();
        closeCommands();
      }
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='combobox'], [role='slider'], [role='spinbutton']")) return;
    if (event.key === "Escape" && entering) {
      event.preventDefault();
      navigationRevision += 1;
      window.PortfolioAnimation?.cancel?.();
      return;
    }
    if (event.key === "Escape" && activeRoute) {
      event.preventDefault();
      navigate(null);
      return;
    }
    const selector = target?.closest("[data-select]");
    if (!selector && target?.closest("a, button, summary, [role='button'], [role='link']")) return;
    if (event.key === ":" || event.key === "/") {
      event.preventDefault();
      openCommands();
    } else if (!activeRoute && event.key === "Enter" && [document.body, root].includes(target)) {
      event.preventDefault();
      enterWorkspace();
    } else if (activeRoute && !event.shiftKey && ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "j", "k"].includes(event.key)) {
      const step = ["ArrowDown", "ArrowRight", "j"].includes(event.key) ? 1 : -1;
      const index = (routes.indexOf(activeRoute) + step + routes.length) % routes.length;
      event.preventDefault();
      navigate(routes[index], false);
      const selected = selectors.find((button) => button.dataset.select === routes[index]);
      selected?.focus({ preventScroll: true });
      selected?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    }
  });

  const systemMotionChanged = () => {
    if (!motionOverride) {
      motion = reducedMotion.matches ? "paused" : "running";
      updatePreferences();
    }
  };
  if (typeof reducedMotion?.addEventListener === "function") reducedMotion.addEventListener("change", systemMotionChanged);
  else reducedMotion?.addListener?.(systemMotionChanged);

  updatePreferences();
  renderRoute(routeFromHash());
  root.dataset.enhanced = "true";
})();
