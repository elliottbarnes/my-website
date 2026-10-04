(() => {
  "use strict";

  const BEST_KEY = "elliott-dragon-ball-trivia-best";
  const ROUND_LENGTH = 5;
  const QUESTIONS = Object.freeze([
    {
      id: "earth-dragon-balls",
      prompt: "How many Dragon Balls summon Earth's dragon?",
      choices: ["Three", "Five", "Seven", "Nine"],
      answer: "Seven",
      fact: "Bring all seven together to summon Shenron.",
    },
    {
      id: "kamehameha",
      prompt: "Who developed the Kamehameha?",
      choices: ["Master Roshi", "King Kai", "Piccolo", "Vegeta"],
      answer: "Master Roshi",
      fact: "Master Roshi created the technique that became Goku's signature move.",
    },
    {
      id: "saiyan-prince",
      prompt: "Who is the prince of the Saiyans?",
      choices: ["Goku", "Vegeta", "Raditz", "Broly"],
      answer: "Vegeta",
      fact: "Vegeta is the son of King Vegeta and prince of the Saiyans.",
    },
    {
      id: "gokus-son",
      prompt: "Which of these characters is Goku's son?",
      choices: ["Krillin", "Yamcha", "Gohan", "Tien"],
      answer: "Gohan",
      fact: "Gohan is Goku's first son, named after the grandfather who raised Goku.",
    },
    {
      id: "first-super-saiyan",
      prompt: "Who is Goku fighting when he first becomes a Super Saiyan?",
      choices: ["Cell", "Frieza", "Vegeta", "Majin Buu"],
      answer: "Frieza",
      fact: "Goku first transforms during his battle with Frieza on Namek.",
    },
    {
      id: "sweets",
      prompt: "Who is known for turning opponents into sweets?",
      choices: ["Cell", "Frieza", "Majin Buu", "Raditz"],
      answer: "Majin Buu",
      fact: "Majin Buu can turn people into treats, including candy and cookies.",
    },
    {
      id: "keepsake",
      prompt: "How many stars are on the Dragon Ball Goku keeps from his grandfather?",
      choices: ["One", "Three", "Four", "Seven"],
      answer: "Four",
      fact: "The four-star Dragon Ball is Goku's keepsake from Grandpa Gohan.",
    },
    {
      id: "full-moon",
      prompt: "What does young Goku become when he looks at a full moon?",
      choices: ["A Super Saiyan", "A Great Ape", "A dragon", "A wolf"],
      answer: "A Great Ape",
      fact: "With his tail intact, the full moon transforms Goku into a Great Ape.",
    },
    {
      id: "porunga",
      prompt: "Which planet's Dragon Balls summon Porunga?",
      choices: ["Earth", "Namek", "Planet Vegeta", "King Kai's planet"],
      answer: "Namek",
      fact: "Porunga is the wish-granting dragon summoned by Namek's Dragon Balls.",
    },
    {
      id: "creator",
      prompt: "Who created Dragon Ball?",
      choices: ["Akira Toriyama", "Eiichiro Oda", "Masashi Kishimoto", "Tite Kubo"],
      answer: "Akira Toriyama",
      fact: "Akira Toriyama created the manga, which began in 1984.",
    },
  ].map(question => Object.freeze({ ...question, choices: Object.freeze(question.choices) })));

  function shuffle(values, random) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function createGame(random = Math.random) {
    let questions, index, selected, answers, score, phase;
    const reset = () => {
      questions = shuffle(QUESTIONS, random).slice(0, ROUND_LENGTH).map(question => {
        const choices = shuffle(question.choices, random);
        return { id: question.id, prompt: question.prompt, choices,
          correctIndex: choices.indexOf(question.answer), fact: question.fact };
      });
      index = 0;
      selected = null;
      answers = Array(ROUND_LENGTH).fill(null);
      score = 0;
      phase = "question";
    };
    reset();
    return {
      get state() {
        return {
          questions: questions.map(question => ({ ...question, choices: [...question.choices] })),
          index, selected, answers: [...answers], score, phase,
        };
      },
      select(choice) {
        if (phase !== "question" || !Number.isInteger(choice) ||
            choice < 0 || choice >= questions[index].choices.length) return false;
        selected = choice;
        answers[index] = choice === questions[index].correctIndex;
        if (answers[index]) score += 1;
        phase = "answered";
        return true;
      },
      next() {
        if (phase !== "answered") return false;
        if (index === ROUND_LENGTH - 1) {
          phase = "complete";
        } else {
          index += 1;
          selected = null;
          phase = "question";
        }
        return true;
      },
      reset,
    };
  }

  function parseBest(value) {
    return typeof value === "string" && /^[0-5]$/.test(value) ? Number(value) : null;
  }

  function readBest(storage) {
    try { return parseBest(storage?.getItem(BEST_KEY)); } catch { return null; }
  }

  function saveBest(storage, score) {
    if (!Number.isInteger(score) || score < 0 || score > ROUND_LENGTH) return false;
    try {
      if (!storage) return false;
      const stored = readBest(storage);
      storage.setItem(BEST_KEY, String(stored === null ? score : Math.max(stored, score)));
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
    module.exports = { QUESTIONS, ROUND_LENGTH, createGame, parseBest, readBest, saveBest, clearBest };
    return;
  }

  const inlineHost = document.querySelector("[data-console-arcade]");
  const consoleHome = document.querySelector("[data-console-home]");
  const inline = Boolean(inlineHost && consoleHome);
  let host, dialog, game, opener, storage, best, saveEnabled;
  let active = false;
  let board, choices, questionTitle, questionView, resultView, resultTitle, resultCopy;
  let status, progress, bestLabel, markers, nextButton, restartButton, saveToggle, storageStatus;

  function render() {
    const state = game.state;
    const complete = state.phase === "complete";
    const answered = state.phase === "answered";
    const question = state.questions[state.index];
    questionView.hidden = complete;
    resultView.hidden = !complete;
    progress.textContent = complete ? "Round complete" : `Question ${state.index + 1} of ${ROUND_LENGTH}`;
    bestLabel.textContent = best === null ? "Best: —" : `Best: ${best}/${ROUND_LENGTH}`;
    markers.forEach((marker, index) => {
      marker.classList.remove("just-earned");
      marker.dataset.state = state.answers[index] === true ? "correct" :
        state.answers[index] === false ? "missed" : !complete && state.index === index ? "current" : "waiting";
      marker.textContent = state.answers[index] === true ? "★" : state.answers[index] === false ? "·" : "";
    });
    nextButton.hidden = !answered;
    nextButton.textContent = state.index === ROUND_LENGTH - 1 ? "See results" : "Next question →";
    restartButton.hidden = !complete;
    if (complete) {
      resultTitle.textContent = `${state.score} out of ${ROUND_LENGTH}`;
      resultCopy.textContent = state.score === ROUND_LENGTH ? "Five for five. Nicely done." :
        state.score >= 3 ? "Nicely done. Another round?" : "A few new facts for next time.";
      status.textContent = "";
      return;
    }
    questionTitle.textContent = question.prompt;
    choices.forEach((button, index) => {
      const correct = answered && index === question.correctIndex;
      const wrong = answered && index === state.selected && !correct;
      button.dataset.state = correct ? "correct" : wrong ? "incorrect" : "ready";
      button.setAttribute("aria-disabled", String(answered));
      button.querySelector(".arcade-answer-text").textContent = question.choices[index];
      button.querySelector(".arcade-answer-mark").textContent = correct ? "✓ Correct" : wrong ? "Your pick" : "";
    });
    status.textContent = answered ? `${state.answers[state.index] ? "Correct." : "Not quite."} ${question.fact}` : "";
  }

  function answer(index) {
    if (!game.select(index)) return;
    render();
    if (game.state.answers[game.state.index]) {
      markers[game.state.index].classList.add("just-earned");
    }
  }

  function finishRound() {
    const score = game.state.score;
    best = best === null ? score : Math.max(best, score);
    if (saveEnabled && !saveBest(storage, best)) {
      storageStatus.textContent = "Storage is unavailable. Your best stays here for this visit.";
    }
  }

  function initialize() {
    game = createGame();
    try { storage = window.localStorage; } catch { storage = null; }
    best = readBest(storage);
    saveEnabled = best !== null;
    host = inline ? inlineHost : document.createElement("dialog");
    host.classList.add(inline ? "arcade-inline" : "arcade-dialog");
    host.setAttribute("aria-labelledby", "arcade-title");
    host.setAttribute("aria-describedby", "arcade-instructions");
    if (!inline) dialog = host;
    host.innerHTML = `
      ${inline ? '<div class="arcade-topbar"><p class="arcade-kicker">Cartridge 05</p><button class="arcade-back" type="button"><span aria-hidden="true">←</span> Back to projects</button></div>' : ""}
      <div class="arcade-heading">
        <div class="arcade-identity"><img src="/assets/dragon-ball.png" alt="" width="44" height="44"><div>${inline ? "" : '<p class="arcade-kicker">Cartridge 05</p>'}<h2 id="arcade-title" tabindex="-1">Dragon Ball trivia</h2></div></div>
        ${inline ? "" : '<button class="arcade-close" type="button" aria-label="Close Dragon Ball trivia">×</button>'}
      </div>
      <p id="arcade-instructions" class="arcade-instructions">Five questions. A quick detour.</p>
      <div class="arcade-score"><span id="arcade-progress" data-arcade-progress></span><span data-arcade-best></span></div>
      <div class="arcade-markers" aria-hidden="true"></div>
      <div class="arcade-question-view">
        <h3 class="arcade-question" id="arcade-question" tabindex="-1" aria-describedby="arcade-progress"></h3>
        <div class="arcade-board" role="group" aria-labelledby="arcade-question"></div>
      </div>
      <div class="arcade-result" hidden>
        <p class="arcade-result-kicker">Your score</p><h3 class="arcade-result-title" tabindex="-1"></h3><p class="arcade-result-copy"></p>
      </div>
      <p class="arcade-status" role="status" aria-live="polite" aria-atomic="true"></p>
      <div class="arcade-actions">
        <button class="arcade-next" type="button" hidden>Next question →</button>
        <button class="arcade-restart" type="button" hidden>Play again</button>
      </div>
      <label class="arcade-save"><input type="checkbox"> Save best on this device</label>
      <p class="arcade-storage" role="status"></p>
      <p class="arcade-keyboard">Tab or arrow keys to choose · Enter to answer · Esc or B to close</p>`;
    if (!inline) document.body.append(host);
    board = host.querySelector(".arcade-board");
    questionTitle = host.querySelector(".arcade-question");
    questionView = host.querySelector(".arcade-question-view");
    resultView = host.querySelector(".arcade-result");
    resultTitle = host.querySelector(".arcade-result-title");
    resultCopy = host.querySelector(".arcade-result-copy");
    status = host.querySelector(".arcade-status");
    progress = host.querySelector("[data-arcade-progress]");
    bestLabel = host.querySelector("[data-arcade-best]");
    nextButton = host.querySelector(".arcade-next");
    restartButton = host.querySelector(".arcade-restart");
    saveToggle = host.querySelector(".arcade-save input");
    storageStatus = host.querySelector(".arcade-storage");
    saveToggle.checked = saveEnabled;
    markers = Array.from({ length: ROUND_LENGTH }, () => {
      const marker = document.createElement("span");
      host.querySelector(".arcade-markers").append(marker);
      return marker;
    });
    choices = Array.from({ length: 4 }, (_, index) => {
      const button = document.createElement("button");
      button.className = "arcade-answer";
      button.type = "button";
      button.innerHTML = `<span class="arcade-answer-letter" aria-hidden="true">${String.fromCharCode(65 + index)}</span><span class="arcade-answer-text"></span><span class="arcade-answer-mark"></span>`;
      button.addEventListener("click", () => answer(index));
      board.append(button);
      return button;
    });
    board.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const index = choices.indexOf(document.activeElement);
      const columns = window.getComputedStyle(board).gridTemplateColumns.trim().split(/\s+/).length;
      const directions = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
      if (index < 0 || !(event.key in directions)) return;
      event.preventDefault();
      event.stopPropagation();
      choices[(index + directions[event.key] + choices.length) % choices.length].focus();
    });
    host.addEventListener("keydown", (event) => {
      // Inline navigation shortcuts may bubble; a modal owns all of its keys.
      if (!inline) event.stopPropagation();
      const target = event.target;
      const isTyping = target instanceof HTMLElement &&
        (target.isContentEditable || /^(TEXTAREA|SELECT)$/.test(target.tagName) ||
          (target.tagName === "INPUT" && target.getAttribute("type") !== "checkbox"));
      const backKey = event.key === "Escape" || event.key.toLowerCase() === "b";
      if (event.defaultPrevented || isTyping || event.altKey || event.ctrlKey || event.metaKey || !backKey) return;
      if (inline && document.querySelector("dialog[open]")) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    });
    nextButton.addEventListener("click", () => {
      if (!game.next()) return;
      if (game.state.phase === "complete") finishRound();
      render();
      (game.state.phase === "complete" ? resultTitle : questionTitle).focus();
    });
    restartButton.addEventListener("click", () => {
      game.reset();
      render();
      questionTitle.focus();
    });
    saveToggle.addEventListener("change", () => {
      saveEnabled = saveToggle.checked;
      if (saveEnabled) {
        storageStatus.textContent = best === null
          ? "Your best will be saved when you finish a round."
          : saveBest(storage, best) ? "Your best is saved on this device."
            : "Storage is unavailable. Your best stays here for this visit.";
      } else {
        storageStatus.textContent = clearBest(storage)
          ? "Saved best removed. Your score stays here for this visit."
          : "Your score will not be saved. Device storage is unavailable.";
      }
    });
    host.querySelector(inline ? ".arcade-back" : ".arcade-close").addEventListener("click", close);
    if (dialog) {
      dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
      dialog.addEventListener("close", () => {
        // Native close events are queued: a reopened game already owns focus.
        if (!dialog.open && active) finishClose();
      });
    }
    render();
  }

  function canFocus(element) {
    return element?.isConnected && !element.disabled && typeof element.focus === "function" &&
      !element.closest("[hidden], [inert]") && element.getClientRects().length > 0;
  }

  function finishClose() {
    active = false;
    window.dispatchEvent(new CustomEvent("portfolio:arcade-close"));
    if (document.querySelector("dialog[open]")) return;
    const homeTrigger = inline && consoleHome.contains(opener) && canFocus(opener) ? opener :
      consoleHome?.querySelector(".demo-launch, [data-controller-open]");
    const target = inline ? (canFocus(homeTrigger) ? homeTrigger :
      [...consoleHome.querySelectorAll("button, a[href]")].find(canFocus)) : opener;
    if (canFocus(target)) target.focus({ preventScroll: !inline });
  }

  function open(trigger = document.activeElement) {
    if (!host) initialize();
    if (active) {
      // A launch from the footer or terminal should bring the existing game back into view.
      if (inline) focusInlineGame();
      return false;
    }
    opener = trigger;
    window.portfolioPlayground?.close?.();
    active = true;
    if (inline) {
      consoleHome.hidden = true;
      host.hidden = false;
    } else {
      dialog.showModal();
    }
    window.dispatchEvent(new CustomEvent("portfolio:arcade-open"));
    if (inline) {
      focusInlineGame();
    } else {
      host.querySelector(".arcade-close").focus();
    }
    return true;
  }

  function focusInlineGame() {
    host.scrollIntoView({ behavior: "auto", block: "start" });
    host.querySelector("#arcade-title").focus({ preventScroll: true });
  }

  function close() {
    if (!active) return false;
    if (inline) {
      host.hidden = true;
      consoleHome.hidden = false;
    } else {
      dialog.close();
    }
    finishClose();
    return true;
  }

  window.portfolioArcade = { open, close, isOpen: () => active };
  document.addEventListener("click", (event) => {
    const trigger = event.target instanceof Element && event.target.closest("[data-arcade-open]");
    if (trigger) open(trigger);
  });
})();
