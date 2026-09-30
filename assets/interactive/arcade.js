(() => {
  "use strict";

  const BEST_KEY = "elliott-signal-match-best";
  const PAIRS = 6;

  function createGame(random = Math.random) {
    let deck, revealed, matched, turns, phase;
    const reset = () => {
      deck = Array.from({ length: PAIRS * 2 }, (_, index) => index % PAIRS + 1);
      for (let index = deck.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [deck[index], deck[other]] = [deck[other], deck[index]];
      }
      revealed = [];
      matched = [];
      turns = 0;
      phase = "ready";
    };
    reset();
    return {
      get state() {
        return { deck: [...deck], revealed: [...revealed], matched: [...matched], turns, phase };
      },
      select(index) {
        if (!Number.isInteger(index) || index < 0 || index >= deck.length ||
            phase === "mismatch" || phase === "complete" ||
            revealed.includes(index) || matched.includes(index)) return false;
        revealed.push(index);
        if (revealed.length === 1) {
          phase = "picking";
        } else {
          turns += 1;
          if (deck[revealed[0]] === deck[revealed[1]]) {
            matched.push(...revealed);
            revealed = [];
            phase = matched.length === deck.length ? "complete" : "ready";
          } else {
            phase = "mismatch";
          }
        }
        return true;
      },
      next() {
        if (phase !== "mismatch") return false;
        revealed = [];
        phase = "ready";
        return true;
      },
      reset,
    };
  }

  function parseBest(value) {
    if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
    const score = Number(value);
    return Number.isSafeInteger(score) && score >= PAIRS ? score : null;
  }

  function readBest(storage) {
    try { return parseBest(storage?.getItem(BEST_KEY)); } catch { return null; }
  }

  function saveBest(storage, score) {
    if (parseBest(String(score)) === null) return false;
    try {
      if (!storage) return false;
      const stored = readBest(storage);
      storage.setItem(BEST_KEY, String(stored === null ? score : Math.min(stored, score)));
      return true;
    } catch { return false; }
  }

  function clearBest(storage) {
    try {
      if (!storage) return false;
      storage.removeItem(BEST_KEY);
      return true;
    } catch { return false; }
  }

  // The game model is also available to the dependency-free Node test suite.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createGame, parseBest, readBest, saveBest, clearBest };
    return;
  }

  let dialog, game, opener, storage, best, saveEnabled;
  let grid, cards, status, progress, bestLabel, nextButton, saveToggle, storageStatus;

  function updateBestLabel() {
    bestLabel.textContent = best === null ? "Best: —" : `Best: ${best} turns`;
  }

  function render(message) {
    const state = game.state;
    cards.forEach((card, index) => {
      const matched = state.matched.includes(index);
      const faceUp = matched || state.revealed.includes(index);
      card.dataset.face = matched ? "matched" : faceUp ? "up" : "down";
      card.setAttribute("aria-label", `Card ${index + 1}, ${matched ? `signal ${state.deck[index]}, matched` : faceUp ? `signal ${state.deck[index]}` : "face down"}`);
      card.setAttribute("aria-disabled", String(matched || state.revealed.includes(index) || state.phase === "mismatch"));
      card.firstElementChild.textContent = faceUp ? String(state.deck[index]).padStart(2, "0") : "?";
      card.lastElementChild.textContent = matched ? "Matched" : faceUp ? "Signal" : String(index + 1).padStart(2, "0");
    });
    progress.textContent = `${state.turns} ${state.turns === 1 ? "turn" : "turns"} · ${state.matched.length / 2}/${PAIRS} pairs`;
    nextButton.hidden = state.phase !== "mismatch";
    updateBestLabel();
    status.textContent = message;
  }

  function flip(index) {
    if (!game.select(index)) return;
    const state = game.state;
    let message;
    if (state.phase === "picking") {
      message = `Signal ${state.deck[index]}. Find its partner.`;
    } else if (state.phase === "mismatch") {
      message = `Signals ${state.deck[state.revealed[0]]} and ${state.deck[state.revealed[1]]}. Remember them, then try the next pair.`;
    } else if (state.phase === "complete") {
      const record = best === null || state.turns < best;
      best = best === null ? state.turns : Math.min(best, state.turns);
      if (saveEnabled && !saveBest(storage, best)) {
        storageStatus.textContent = "Storage is unavailable. Your best stays here for this visit.";
      }
      message = `All six signals matched in ${state.turns} turns!${record ? " A new personal best." : " Play again to beat your best."}`;
    } else {
      message = `Signal ${state.deck[index]} matched! Choose another pair.`;
    }
    render(message);
  }

  function initialize() {
    game = createGame();
    try { storage = window.localStorage; } catch { storage = null; }
    best = readBest(storage);
    saveEnabled = best !== null;
    dialog = document.createElement("dialog");
    dialog.className = "arcade-dialog";
    dialog.setAttribute("aria-labelledby", "arcade-title");
    dialog.setAttribute("aria-describedby", "arcade-instructions");
    dialog.innerHTML = `
      <div class="arcade-heading">
        <div><p class="arcade-kicker">Secret cartridge unlocked</p><h2 id="arcade-title">Signal Match</h2></div>
        <button class="arcade-close" type="button" aria-label="Close Signal Match">×</button>
      </div>
      <p id="arcade-instructions" class="arcade-instructions">Find six matching pairs. Flip two cards per turn. Take your time: fewer turns wins.</p>
      <div class="arcade-score"><span data-arcade-progress></span><span data-arcade-best></span></div>
      <div class="arcade-board" role="group" aria-label="Signal cards"></div>
      <p class="arcade-status" role="status" aria-live="polite" aria-atomic="true"></p>
      <div class="arcade-actions">
        <button class="arcade-next" type="button" hidden>Try next pair</button>
        <button class="arcade-restart" type="button">Restart game</button>
      </div>
      <label class="arcade-save"><input type="checkbox"> Save best on this device</label>
      <p class="arcade-storage" role="status"></p>
      <p class="arcade-keyboard">Keyboard: Tab or arrow keys to choose · Enter or Space to flip · Esc to close</p>`;
    document.body.append(dialog);
    grid = dialog.querySelector(".arcade-board");
    status = dialog.querySelector(".arcade-status");
    progress = dialog.querySelector("[data-arcade-progress]");
    bestLabel = dialog.querySelector("[data-arcade-best]");
    nextButton = dialog.querySelector(".arcade-next");
    saveToggle = dialog.querySelector(".arcade-save input");
    storageStatus = dialog.querySelector(".arcade-storage");
    saveToggle.checked = saveEnabled;
    cards = Array.from({ length: PAIRS * 2 }, (_, index) => {
      const card = document.createElement("button");
      card.className = "arcade-card";
      card.type = "button";
      card.innerHTML = "<span></span><small></small>";
      card.addEventListener("click", () => flip(index));
      grid.append(card);
      return card;
    });
    grid.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const index = cards.indexOf(document.activeElement);
      const directions = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
      if (index < 0 || !(event.key in directions)) return;
      event.preventDefault();
      cards[(index + directions[event.key] + cards.length) % cards.length].focus();
    });
    // Keep page-level shortcuts isolated, while preserving the controller's back key.
    dialog.addEventListener("keydown", (event) => {
      event.stopPropagation();
      const target = event.target;
      const isTyping = target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (!isTyping && !event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        close();
      }
    });
    nextButton.addEventListener("click", () => {
      if (!game.next()) return;
      render("Choose two cards to find another pair.");
      const state = game.state;
      cards.find((_, index) => !state.matched.includes(index))?.focus();
    });
    dialog.querySelector(".arcade-restart").addEventListener("click", () => {
      game.reset();
      render("New game. Choose two cards to find a matching pair.");
      cards[0].focus();
    });
    saveToggle.addEventListener("change", () => {
      saveEnabled = saveToggle.checked;
      if (saveEnabled) {
        storageStatus.textContent = best === null
          ? "Your best will be saved when you finish a game."
          : saveBest(storage, best) ? "Your best is saved on this device."
            : "Storage is unavailable. Your best stays here for this visit.";
      } else {
        storageStatus.textContent = clearBest(storage)
          ? "Saved best removed. Your score stays here for this visit."
          : "Your score will not be saved. Device storage is unavailable.";
      }
    });
    dialog.querySelector(".arcade-close").addEventListener("click", close);
    dialog.addEventListener("close", () => {
      // Close events are queued: another modal may already own focus by this point.
      if (!document.querySelector("dialog[open]") && opener?.isConnected && typeof opener.focus === "function") {
        opener.focus({ preventScroll: true });
      }
    });
    render("Choose two cards to find a matching pair.");
  }

  function open() {
    if (!dialog) initialize();
    if (dialog.open) return;
    opener = document.activeElement;
    dialog.showModal();
    dialog.querySelector(".arcade-close").focus();
  }

  function close() {
    if (dialog?.open) dialog.close();
  }

  window.portfolioArcade = { open, close, isOpen: () => Boolean(dialog?.open) };
  document.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("[data-arcade-open]")) open();
  });
})();
