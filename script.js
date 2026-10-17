/* Progressive enhancement: every section and ordinary link works without JavaScript. */
(() => {
  "use strict";

  const root = document.documentElement;
  const entrance = document.getElementById("entrance");
  const workspace = document.getElementById("workspace");
  const panels = new Map(Array.from(document.querySelectorAll("[data-panel]"), (panel) => [panel.dataset.panel, panel]));
  const routes = ["about", "glassbox", "pixel-language", "architecture-lab", "automata-lab", "ellmiott", "batchline", "evaldeck", "connect"].filter((id) => panels.has(id));
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
  const aliases = { whoami: "about", links: "connect", projects: "glassbox", pixel: "pixel-language", architecture: "architecture-lab", automata: "automata-lab" };
  const searchAliases = {
    about: "whoami about elliott profile developer",
    glassbox: "compiler compilers webassembly wasm typed language",
    "pixel-language": "pixel graphics shader shaders glsl language compiler",
    "architecture-lab": "architecture mac macintosh hardware computer memory",
    "automata-lab": "automata regex regular expression pattern dfa nfa matching compiler",
    ellmiott: "attention gpt model tokens prediction transformer ai",
    batchline: "batch batching queue backpressure inference scheduling",
    evaldeck: "evaluation eval contracts checks regressions baseline answers ai",
    connect: "links github linkedin contact",
    theme: "theme themes colour color colours colors palette",
    motion: "motion animation pause resume",
    ecdsa: "ecdsa elliptic curve signature signing cryptography verification",
    help: "help commands shortcuts keyboard",
    goku: "goku dragon ball adventure story episode",
  };
  const normalizeCommand = value => String(value).trim().toLowerCase().replace(/^[:/]\s*/, "").replace(/\s+/g, " ");
  const searchWords = value => normalizeCommand(value).replace(/[^a-z0-9]+/g, " ").trim();
  const commandButtons = Array.from(document.querySelectorAll("[data-command]"));
  const commandResults = dialog?.querySelector(".command-options");
  const commandRecords = commandButtons.map((button, index) => {
    const command = button.dataset.command;
    const panel = panels.get(command);
    const label = ({ "pixel-language": "pixel", "architecture-lab": "architecture", "automata-lab": "automata" })[command]
      || button.textContent.trim().toLowerCase();
    const title = panel?.querySelector("h2")?.textContent.replace(/_$/, "").trim() || label;
    const kind = panel?.querySelector(".project-kind")?.textContent.replace(/^\d+\s*\/\s*/, "").trim().toLowerCase() || "";
    const description = panel?.querySelector(".project-description, .about-text")?.textContent || "";
    button.textContent = label;
    button.dataset.commandLabel = label;
    if (kind) {
      const detail = document.createElement("span");
      detail.className = "command-meta";
      detail.textContent = kind;
      button.append(detail);
      button.setAttribute("aria-label", `${label}, ${kind}`);
    }
    return { button, command, label, kind, index, title: searchWords(title),
      names: searchWords(`${command} ${label} ${searchAliases[command] || ""}`),
      details: searchWords(`${kind} ${description}`) };
  });
  let searchResults = commandRecords, activeResult = -1, composingCommand = false;

  if (commandResults && commandInput) {
    commandResults.id ||= "command-results";
    commandResults.setAttribute("role", "group");
    commandResults.setAttribute("aria-label", "project and command results");
    commandInput.setAttribute("aria-controls", commandResults.id);
    commandInput.setAttribute("aria-describedby", "command-feedback");
  }

  function themeCommands() {
    return ["theme", "light", "dark", "theme light", "theme dark",
      ...[...themes, ...(window.PortfolioThemes?.names || []), ...(window.PortfolioThemes?.labels || [])].map(name => `theme ${name}`)];
  }

  function exactCommand(command) {
    return routes.includes(aliases[command] || command) || themeCommands().includes(command)
      || ["home", "exit", "motion", "ecdsa", "goku", "help", "?", "kamehameha", "training", "breaker", "ki", "charge", "radar", "hunt", "wish", "shenron"].includes(command);
  }

  function rankCommand(record, query) {
    if (searchWords(record.command) === query || record.label === query) return 200;
    const words = query.split(" ").filter(Boolean);
    if (!words.length) return 0;
    let score = 0;
    for (const word of words) {
      if (record.names.split(" ").includes(word)) score += 60;
      else if (record.names.split(" ").some(name => name.startsWith(word))) score += 40;
      else if (record.title.includes(word)) score += 25;
      else if (record.details.includes(word)) score += 15;
      else return 0;
    }
    return score;
  }

  function announceResult() {
    const record = searchResults[activeResult];
    if (!record) return;
    say(`${record.label}${record.kind ? `, ${record.kind}` : ""}. ${activeResult + 1} of ${searchResults.length}. enter to ${routes.includes(record.command) ? "open" : "run"}.`);
  }

  function paintResults() {
    const query = normalizeCommand(commandInput?.value || "");
    if (commandResults) commandResults.dataset.searching = String(Boolean(query));
    commandRecords.forEach(record => {
      const index = searchResults.indexOf(record);
      record.button.hidden = index < 0;
      record.button.style.order = "";
    });
    // Move the existing native buttons so Tab follows the same ranked order
    // visitors see; CSS ordering alone would leave keyboard focus out of sync.
    if (commandResults) [...searchResults, ...commandRecords.filter(record => !searchResults.includes(record))]
      .forEach(record => commandResults.append(record.button));
    paintActiveResult();
  }

  function paintActiveResult() {
    const active = searchResults[activeResult];
    commandRecords.forEach(record => { record.button.dataset.searchActive = String(record === active); });
  }

  function searchCommands(announce = true) {
    const raw = normalizeCommand(commandInput?.value || "");
    const query = searchWords(raw);
    searchResults = !raw ? [...commandRecords] : query ? commandRecords.map(record => ({ record, score: rankCommand(record, query) }))
      .filter(result => result.score > 0).sort((a, b) => b.score - a.score || a.record.index - b.record.index)
      .map(result => result.record) : [];
    activeResult = query && searchResults.length ? 0 : -1;
    paintResults();
    if (!announce) return;
    if (!raw) say("search projects or type a command.");
    else if (exactCommand(raw)) say(`press enter to run “${raw}”.`);
    else if (!searchResults.length) say("no matching projects or commands. try compiler, mac, regex, attention, or batching.");
    else announceResult();
  }

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
    const themeLabel = window.PortfolioThemes?.label || theme;
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", `Choose colorscheme; current theme: ${themeLabel}`);
      button.setAttribute("title", "Select a colour theme");
    });
    document.querySelectorAll("[data-theme-label]").forEach((label) => { label.textContent = themeLabel; });
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
      else window.PortfolioThemes.apply(next);
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
    const position = document.querySelector("[data-wheel-position]");
    if (position && id) {
      const current = routes.indexOf(id) + 1;
      position.textContent = `${String(current).padStart(2, "0")} / ${String(routes.length).padStart(2, "0")}`;
      position.setAttribute("aria-label", `Section ${current} of ${routes.length}`);
    }
    if (changed && id) {
      const announcement = document.querySelector("[data-wheel-announcement]");
      const title = panels.get(id)?.querySelector("h2")?.textContent.replace(/_$/, "").trim() || id;
      if (announcement) announcement.textContent = `${title}, section ${routes.indexOf(id) + 1} of ${routes.length}`;
    }
    const status = document.getElementById("status-view");
    if (status) { status.textContent = ({ "pixel-language": "pixel", "architecture-lab": "architecture", "automata-lab": "automata" })[id] || id || "entrance"; status.title = id || "entrance"; }
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
    composingCommand = false;
    searchCommands();
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
    const command = normalizeCommand(raw);
    if (command === "ecdsa") {
      closeCommands(false);
      navigate(null, false);
      window.PortfolioAnimation?.openECDSA();
      return;
    }
    if (["wish", "shenron"].includes(command)) {
      if (!window.PortfolioRadar?.unlocked) {
        say("follow all seven project signals first.");
        commandInput?.focus();
        return;
      }
      closeCommands(false);
      navigate("about");
      window.PortfolioRadar.summon();
      document.querySelector("[data-radar-summon]")?.focus({ preventScroll: true });
      return;
    }
    if (["kamehameha", "training", "breaker"].includes(command)) {
      closeCommands(false);
      window.PortfolioTraining?.open();
      return;
    }
    if (["ki", "charge", "radar", "hunt"].includes(command)) {
      closeCommands(false);
      window.PortfolioArcade?.open(["radar", "hunt"].includes(command) ? "radar" : "ki", dialogOpener);
      return;
    }
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
    } else if (themeCommands().includes(command)) {
      const requested = command.replace(/^theme\s*/, "");
      if (!requested && window.PortfolioThemes) {
        closeCommands(false);
        if (dialogOpener?.isConnected) dialogOpener.focus({ preventScroll: true });
        setTheme();
        return;
      }
      setTheme(requested === "light" ? (window.PortfolioThemes ? "whitegold" : "parchment") : requested === "dark" ? "carbon" : requested);
      say(`Theme: ${window.PortfolioThemes?.label || theme}.`);
    } else if (command === "motion") {
      toggleMotion();
      say(`Animation ${motion === "paused" ? "paused" : "running"}.`);
    } else if (command === "help" || command === "?") {
      if (help) help.hidden = !help.hidden;
      say("Commands: about, projects, glassbox, pixel, architecture, automata, ellmiott, batchline, evaldeck, connect, home, theme, light, dark, motion, ecdsa, goku, help. Use arrow keys on the wheel or j/k to browse sections; Home/End select its first/last item. Escape returns home.");
    } else {
      say(command ? "Unknown command. Type help to see the available commands." : "Enter a command, such as about or theme.");
    }
    if (commandInput) {
      commandInput.value = "";
      searchCommands(false);
      commandInput.focus();
    }
  }

  document.querySelectorAll("[data-current-year]").forEach((year) => { year.textContent = String(new Date().getFullYear()); });
  if (!window.PortfolioThemes) document.querySelectorAll("[data-theme-toggle]").forEach((button) => button.addEventListener("click", () => setTheme()));
  document.querySelectorAll("[data-motion-toggle]").forEach((button) => button.addEventListener("click", toggleMotion));
  document.querySelectorAll("[data-command-open]").forEach((button) => button.addEventListener("click", openCommands));
  document.querySelectorAll("[data-command-close]").forEach((button) => button.addEventListener("click", () => closeCommands()));
  commandButtons.forEach((button) => {
    button.addEventListener("click", () => runCommand(button.dataset.command));
    button.addEventListener("focus", () => {
      if (!dialog?.open) return;
      const index = searchResults.findIndex(record => record.button === button);
      if (index < 0) return;
      activeResult = index;
      // Update selection without moving the focused native button in the DOM.
      paintActiveResult(); announceResult();
    });
  });
  commandInput?.addEventListener("compositionstart", () => { composingCommand = true; });
  commandInput?.addEventListener("compositionend", () => { composingCommand = false; searchCommands(); });
  commandInput?.addEventListener("input", event => {
    if (!composingCommand && !event.isComposing) searchCommands();
  });
  commandInput?.addEventListener("keydown", event => {
    if (event.defaultPrevented) return;
    if (event.isComposing || composingCommand || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) {
      if (event.key === "Enter") event.preventDefault();
      return;
    }
    if (!["ArrowDown", "ArrowUp"].includes(event.key) || !searchResults.length) return;
    event.preventDefault();
    activeResult = activeResult < 0 ? (event.key === "ArrowDown" ? 0 : searchResults.length - 1)
      : (activeResult + (event.key === "ArrowDown" ? 1 : -1) + searchResults.length) % searchResults.length;
    paintResults(); announceResult();
    searchResults[activeResult].button.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
  });
  document.getElementById("command-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (composingCommand || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const raw = normalizeCommand(commandInput?.value || "");
    if (exactCommand(raw)) runCommand(raw);
    else if (searchResults.length && (raw || activeResult >= 0)) runCommand(searchResults[Math.max(0, activeResult)].command);
    else if (!raw) runCommand(raw);
    else say("no matching projects or commands. try compiler, mac, regex, attention, or batching.");
  });
  dialog?.addEventListener("close", () => {
    if (restoreDialogFocus && dialogOpener?.isConnected) dialogOpener.focus({ preventScroll: true });
  });

  selectors.forEach((button) => button.addEventListener("click", () => navigate(button.dataset.select, false)));
  document.querySelectorAll("[data-wheel-step]").forEach((button) => button.addEventListener("click", () => {
    if (!activeRoute) return;
    const index = (routes.indexOf(activeRoute) + Number(button.dataset.wheelStep) + routes.length) % routes.length;
    navigate(routes[index], false);
  }));
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
    // Native fragment navigation can scroll the inner pane under its sticky title.
    const terminal = workspace?.querySelector(".terminal");
    if (terminal) terminal.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  window.addEventListener("load", () => {
    const terminal = workspace?.querySelector(".terminal");
    if (terminal) terminal.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (document.getElementById("theme-dialog")?.open || document.getElementById("training-dialog")?.open || document.getElementById("arcade-dialog")?.open || document.getElementById("goku-dialog")?.open) return;
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
    } else if (activeRoute && selector && ["Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? routes[0] : routes.at(-1);
      navigate(next, false);
      selectors.find((button) => button.dataset.select === next)?.focus({ preventScroll: true });
    } else if (activeRoute && !event.shiftKey && (["j", "k"].includes(event.key) || (selector && ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)))) {
      const step = ["ArrowDown", "ArrowRight", "j"].includes(event.key) ? 1 : -1;
      const index = (routes.indexOf(activeRoute) + step + routes.length) % routes.length;
      event.preventDefault();
      navigate(routes[index], false);
      const selected = selectors.find((button) => button.dataset.select === routes[index]);
      selected?.focus({ preventScroll: true });
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
