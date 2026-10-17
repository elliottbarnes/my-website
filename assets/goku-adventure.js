// A local, deliberate interface for one deterministic episode. No timers or storage.
(() => {
  "use strict";
  const story = window.PortfolioGokuStory;
  const dialog = document.getElementById("goku-dialog");
  if (!story || !dialog) return;
  const root = document.documentElement;
  const scene = document.getElementById("goku-scene");
  const title = document.getElementById("goku-scene-title");
  const prose = document.getElementById("goku-prose");
  const memory = document.getElementById("goku-memory");
  const choices = document.getElementById("goku-choices");
  const history = document.getElementById("goku-history");
  const journal = document.getElementById("goku-journal");
  const input = document.getElementById("goku-input");
  const status = document.getElementById("goku-status");
  const form = document.getElementById("goku-form");
  const scroll = document.getElementById("goku-scroll");
  let state = story.create(), opener = null, composing = false, confirming = false;
  // An old detached button must never become a command for a newer scene.
  let renderRevision = 0;
  const otherGameOpen = () => Boolean(document.getElementById("training-dialog")?.open || document.getElementById("arcade-dialog")?.open);
  const announce = text => { status.textContent = text; };
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  };

  function focusScene() { scene.focus({ preventScroll: true }); }
  function showHelp() {
    const commands = confirming ? ["confirm", "cancel"] : story.view(state).choices.map(choice => choice.command);
    announce(`available: ${[...commands, "help", "exit", ...(confirming ? [] : ["restart"])].join(" · ")}. choose a button or type its command. your progress stays here when you exit.`);
  }

  function render({ focus = false } = {}) {
    const view = story.view(state), revision = ++renderRevision, stateRevision = state.revision;
    document.getElementById("goku-objective").textContent = view.objective;
    document.getElementById("goku-progress").textContent = view.complete ? "episode complete" : `${view.decision} / 3 decisions`;
    title.textContent = view.title;
    prose.replaceChildren(...view.paragraphs.map(text => element("p", text)));
    memory.textContent = view.summary.join(" ");
    memory.hidden = !view.summary.length;
    choices.replaceChildren();
    const available = confirming ? [
      { command: "confirm", label: "start over", detail: "discard this episode's progress and return to the beginning." },
      { command: "cancel", label: "keep playing", detail: "return to this moment with every decision intact." },
    ] : view.choices;
    for (const choice of available) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "goku-choice";
      button.append(element("span", choice.command, "goku-choice-command"), element("span", choice.label, "goku-choice-label"));
      if (choice.detail) button.append(element("small", choice.detail, "goku-choice-detail"));
      button.addEventListener("click", () => {
        if (revision !== renderRevision || !dialog.open) return;
        submit(choice.command, { expectedRevision: stateRevision, focus: true });
      });
      choices.append(button);
    }
    // The transcript is deliberate history, outside the live status region.
    history.replaceChildren(...state.trail.map(entry => {
      const item = document.createElement("li");
      item.append(element("h4", `${entry.title} · ${entry.command}`), element("p", entry.label));
      for (const response of entry.response) item.append(element("p", response));
      return item;
    }));
    journal.hidden = !state.trail.length;
    scroll.scrollTop = 0;
    // Short landscape layouts scroll the dialog itself instead of the reading
    // region. Both layouts must start the new scene at its beginning.
    dialog.scrollTop = 0;
    if (focus) focusScene();
    else if (document.activeElement === input) {
      // With a software keyboard, the short layout has one outer scroller.
      // Typed play keeps its prompt visible; taps return to the scene's start.
      input.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    }
  }

  function submit(raw, { expectedRevision = state.revision, focus = false } = {}) {
    if (!dialog.open) return;
    const command = story.normalize(raw);
    if (!command) { announce("choose an available action or type help."); return; }
    if (command === "exit") { close(); return; }
    if (command === "help" || command === "?") { input.value = ""; showHelp(); return; }
    if (command === "restart") {
      confirming = true; input.value = ""; render({ focus });
      announce("start over? choose confirm to discard your progress, or cancel to keep it."); return;
    }
    if (confirming) {
      if (command !== "confirm" && command !== "cancel") {
        announce("restart is waiting for your decision. type confirm or cancel; exit keeps your current progress."); return;
      }
      if (command === "confirm") state = story.create();
      confirming = false; input.value = ""; render({ focus });
      announce(command === "confirm" ? "a fresh episode. begin when you are ready." : "restart cancelled. your progress is unchanged."); return;
    }
    const result = story.choose(state, command, expectedRevision);
    if (!result.accepted) { announce(result.message); return; }
    state = result.state; input.value = ""; render({ focus });
    const next = story.view(state), response = state.trail.at(-1)?.response.join(" ") || result.message;
    // Keyboard play keeps its input focus, so announce the immediate consequence
    // and next options without re-reading the complete story as a live region.
    announce(`${response} ${next.complete ? "episode complete. exit or restart when ready." : `next: ${next.title}. available: ${next.choices.map(choice => choice.command).join(" · ")}.`}`);
  }

  function usableFocus(target) {
    return target?.isConnected && typeof target.focus === "function"
      && !target.disabled && !target.closest?.("[hidden], dialog:not([open])");
  }
  function cleanup() {
    // Native close events are queued; reopening first must keep the new modal active.
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
    if (dialog.open) { focusScene(); return true; }
    if (otherGameOpen() || document.getElementById("theme-dialog")?.open) return false;
    opener = trigger; confirming = false; composing = false; input.value = "";
    dialog.showModal(); root.dataset.training = "open";
    render({ focus: true });
    announce("choose an action below, or type help. exit returns to the portfolio and keeps your progress.");
    window.dispatchEvent(new CustomEvent("portfolio:training", { detail: { open: true } }));
    return true;
  }

  input.addEventListener("compositionstart", () => { composing = true; });
  input.addEventListener("compositionend", () => { composing = false; });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && (event.repeat || event.isComposing || composing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)) event.preventDefault();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (composing || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    submit(input.value);
  });
  document.getElementById("goku-close").addEventListener("click", close);
  document.getElementById("goku-help").addEventListener("click", showHelp);
  document.getElementById("goku-restart").addEventListener("click", () => submit("restart", { focus: true }));
  dialog.addEventListener("cancel", event => { event.stopPropagation(); });
  dialog.addEventListener("close", cleanup);
  window.addEventListener("portfolio:view", close);
  window.PortfolioGoku = Object.freeze({ open, close });
})();
