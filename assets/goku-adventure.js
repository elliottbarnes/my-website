// Local command interpreter for one deterministic episode. No timers or storage.
(() => {
  "use strict";
  const story = window.PortfolioGokuStory, terminal = window.PortfolioGokuTerminal;
  const dialog = document.getElementById("goku-dialog");
  if (!story || !terminal || !dialog) return;
  const root = document.documentElement;
  const output = document.getElementById("goku-output");
  const transcript = document.getElementById("goku-transcript");
  const shortcuts = document.getElementById("goku-choices");
  const input = document.getElementById("goku-input");
  const status = document.getElementById("goku-status");
  const form = document.getElementById("goku-form");
  let state = story.create(), opener = null, composing = false, confirming = false;
  let renderRevision = 0, started = false, history = [], historyIndex = 0, draft = "", inspection = false;
  const otherGameOpen = () => ["training-dialog", "arcade-dialog", "piccolo-dialog", "platformer-dialog", "game-loading-dialog"].some(id => document.getElementById(id)?.open);
  const announce = text => { status.textContent = text; };
  const element = (tag, text, className) => {
    const node = document.createElement(tag); node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function append(echo, lines, screen) {
    const entry = document.createElement("section"); entry.className = "goku-entry";
    if (echo) entry.append(element("p", `> ${echo}`, "goku-echo"));
    if (screen) {
      entry.append(element("h3", screen.title, "goku-room-title"));
      const art = element("pre", screen.art, "goku-ascii"); art.setAttribute("aria-hidden", "true"); entry.append(art);
    }
    for (const line of lines) {
      if (line.includes("\n")) entry.append(element("pre", line, "goku-map"));
      else entry.append(element("p", line, "goku-reply"));
    }
    transcript.append(entry);
    // A long inspection session cannot grow an unbounded DOM.
    while (transcript.children.length > 80) transcript.firstElementChild.remove();
    output.scrollTop = output.scrollHeight;
  }
  function focusAfter(tapped) {
    if (tapped) output.focus({ preventScroll: true });
    else if (document.activeElement === input) input.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }
  function available() {
    if (confirming) return ["confirm", "cancel", "help", "exit"];
    return [...terminal.screen(state).actions.map(action => action.command), "look", "look gate", "look rock", "look channel", "talk bulma", "map", "status", "read", "help", "clear", "restart", "exit"];
  }
  function renderShortcuts() {
    const screen = terminal.screen(state), token = ++renderRevision, revision = state.revision;
    document.getElementById("goku-location").textContent = `@ ${screen.location}`;
    shortcuts.replaceChildren();
    let commands = confirming ? ["confirm", "cancel"] : screen.actions.map(action => action.command);
    if (inspection && !confirming) commands = [...commands, "look", "talk bulma", "map", "status", "read"];
    if (!commands.length) commands = ["look", "restart", "exit"];
    if (!commands.includes("help")) commands.push("help");
    for (const command of commands) {
      const button = element("button", command, "goku-shortcut"); button.type = "button";
      button.dataset.command = command;
      button.addEventListener("click", () => {
        if (token !== renderRevision || !dialog.open) return;
        submit(command, { expectedRevision: revision, tapped: true });
      });
      shortcuts.append(button);
    }
  }
  function scene(echo) {
    const screen = terminal.screen(state);
    append(echo, screen.description, screen);
    renderShortcuts();
    announce(`${screen.title}. ${screen.description.join(" ")} available: ${screen.actions.map(action => action.command).join(", ") || "restart, exit"}.`);
  }
  function remember(command) {
    if (history.at(-1) !== command) history.push(command);
    if (history.length > 50) history.shift();
    historyIndex = history.length; draft = "";
  }
  function help(echo) {
    inspection = !confirming;
    const lines = confirming ? ["restart is waiting: confirm starts over; cancel keeps your progress. exit closes the terminal."] : [
      `actions here: ${terminal.screen(state).actions.map(action => action.command).join(" / ") || "restart / exit"}.`,
      "look — inspect the scene. look gate / look rock / look channel — examine something. talk bulma — ask for advice.",
      "map — see the valley. status — review preparations. read — read the full scene. clear — clear the screen, keep progress.",
      "up/down — command history. tab — complete a command. restart — start over after confirmation. exit or esc — return to the site.",
    ];
    append(echo, lines); renderShortcuts(); announce(lines.join(" "));
  }
  function submit(raw, { expectedRevision = state.revision, tapped = false } = {}) {
    if (!dialog.open || expectedRevision !== state.revision) return;
    const parsed = terminal.parse(state, raw);
    if (!raw.trim()) { announce("type a command, or choose one below. help lists the verbs."); return; }
    const echo = parsed.echo || raw.trim().slice(0, 64);
    remember(echo); input.value = "";
    if (parsed.kind === "utility" && parsed.command === "exit") { close(); return; }
    if (parsed.kind === "utility" && parsed.command === "help") { help(echo); focusAfter(tapped); return; }
    if (parsed.kind === "utility" && parsed.command === "restart") {
      confirming = true; inspection = false;
      append(echo, ["start a new adventure? confirm discards your progress; cancel keeps it."]);
      renderShortcuts(); announce("start over? type confirm or cancel."); focusAfter(tapped); return;
    }
    if (confirming) {
      if (parsed.kind !== "utility" || !["confirm", "cancel"].includes(parsed.command)) {
        append(echo, ["restart is waiting. type confirm or cancel; exit keeps your progress."]);
        announce("restart is waiting. confirm or cancel."); focusAfter(tapped); return;
      }
      confirming = false;
      if (parsed.command === "confirm") {
        state = story.create(); transcript.replaceChildren(); history = []; historyIndex = 0; draft = ""; scene("restart");
      } else {
        append(echo, ["restart cancelled. your adventure is unchanged."]); renderShortcuts(); announce("restart cancelled.");
      }
      focusAfter(tapped); return;
    }
    if (parsed.kind === "utility" && parsed.command === "clear") {
      transcript.replaceChildren(); scene(echo); focusAfter(tapped); return;
    }
    if (parsed.kind === "read" || parsed.kind === "invalid") {
      append(echo, parsed.lines); announce(parsed.lines.join(" ")); focusAfter(tapped); return;
    }
    if (parsed.kind === "action") {
      const result = story.choose(state, parsed.command, expectedRevision);
      if (result.accepted) { state = result.state; inspection = false; scene(echo); }
      else { append(echo, [result.message]); announce(result.message); }
      focusAfter(tapped); return;
    }
    append(echo, ["nothing to confirm. type help for available commands."]);
    announce("nothing to confirm. type help."); focusAfter(tapped);
  }
  function usableFocus(target) {
    return target?.isConnected && typeof target.focus === "function" && !target.disabled && !target.closest?.("[hidden], dialog:not([open])");
  }
  function cleanup() {
    if (dialog.open) return;
    confirming = false; composing = false; renderRevision++;
    const another = otherGameOpen();
    if (!another) delete root.dataset.training;
    window.dispatchEvent(new CustomEvent("portfolio:training", { detail: { open: another } }));
    if (!another && !document.querySelector("dialog[open]")) {
      const target = usableFocus(opener) ? opener : document.querySelector("[data-command-open]");
      if (usableFocus(target)) target.focus({ preventScroll: true });
    }
    opener = null;
  }
  function close() { if (dialog.open) dialog.close(); }
  function open(trigger = document.activeElement) {
    if (dialog.open) { output.focus({ preventScroll: true }); return true; }
    if (otherGameOpen() || document.getElementById("theme-dialog")?.open) return false;
    opener = trigger; confirming = false; composing = false; input.value = ""; historyIndex = history.length; draft = "";
    dialog.showModal(); root.dataset.training = "open";
    if (!started) {
      started = true;
      append(null, ["capsule corp. adventure system", "goku: the quiet current / original fan episode", "type a verb at the prompt, or tap it below. help lists the commands."]);
      scene(null);
    } else {
      append(null, ["session resumed. type look to inspect your surroundings."]); renderShortcuts();
      announce("session resumed. your progress is unchanged. type look or help.");
    }
    output.focus({ preventScroll: true }); output.scrollTop = output.scrollHeight;
    window.dispatchEvent(new CustomEvent("portfolio:training", { detail: { open: true } }));
    return true;
  }
  input.addEventListener("compositionstart", () => { composing = true; });
  input.addEventListener("compositionend", () => { composing = false; });
  input.addEventListener("input", () => { historyIndex = history.length; draft = input.value; });
  input.addEventListener("keydown", event => {
    const modified = event.isComposing || composing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
    if (event.key === "Enter" && (event.repeat || modified)) { event.preventDefault(); return; }
    if (modified || event.repeat) return;
    if (["ArrowUp", "ArrowDown"].includes(event.key) && history.length) {
      event.preventDefault();
      if (historyIndex === history.length) draft = input.value;
      historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === "ArrowUp" ? -1 : 1)));
      input.value = historyIndex === history.length ? draft : history[historyIndex];
      input.setSelectionRange?.(input.value.length, input.value.length);
    } else if (event.key === "Tab" && input.value.trim()) {
      const prefix = input.value.trim().toLowerCase(), matches = available().filter(command => command.startsWith(prefix));
      if (matches.length === 1 && matches[0] !== prefix) {
        event.preventDefault(); input.value = matches[0]; historyIndex = history.length; draft = input.value;
        announce(`completed: ${input.value}`);
      } else if (matches.length > 1) announce(`possible commands: ${matches.join(", ")}`);
    }
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (composing || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    submit(input.value);
  });
  document.getElementById("goku-close").addEventListener("click", close);
  dialog.addEventListener("cancel", event => { event.stopPropagation(); });
  dialog.addEventListener("close", cleanup);
  window.addEventListener("portfolio:view", close);
  window.PortfolioGoku = Object.freeze({ open, close });
})();
