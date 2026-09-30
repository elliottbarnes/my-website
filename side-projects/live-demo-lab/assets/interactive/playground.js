(function (global) {
  "use strict";

  // These small, deterministic functions also run in Node for domain tests.
  const clampInteger = (value, min, max) => Math.min(max, Math.max(min, Math.trunc(Number(value) || 0)));
  const emptyQueue = () => ({ tick: 0, queued: 0, completed: 0, rejected: 0, received: 0 });
  function stepQueue(state, arrivals, workers, capacity = 18) {
    const size = clampInteger(capacity, 1, 100);
    const incoming = clampInteger(arrivals, 0, 100);
    const service = clampInteger(workers, 1, 100);
    const accepted = Math.min(incoming, Math.max(0, size - state.queued));
    const processed = Math.min(service, state.queued + accepted);
    return {
      tick: state.tick + 1,
      queued: state.queued + accepted - processed,
      completed: state.completed + processed,
      rejected: state.rejected + incoming - accepted,
      received: state.received + incoming,
    };
  }

  const DEMO_LIMITS = Object.freeze({ textCharacters: 4000, textWords: 300, csvCharacters: 20000, csvRecords: 200 });
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const money = (cents) => `${cents < 0 ? "−" : ""}$${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
  function validateComparisonText(text) {
    if (typeof text !== "string" || text.length > DEMO_LIMITS.textCharacters || (text.match(/\S+/g) || []).length > DEMO_LIMITS.textWords) {
      throw new RangeError(`Keep each answer within ${DEMO_LIMITS.textCharacters} characters and ${DEMO_LIMITS.textWords} words.`);
    }
  }

  function diffWords(before, after) {
    validateComparisonText(before);
    validateComparisonText(after);
    const a = before.match(/\S+\s*|\s+/g) || [];
    const b = after.match(/\S+\s*|\s+/g) || [];
    const table = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
    const changes = [];
    let i = 0;
    let j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) {
        changes.push({ type: "same", text: a[i++] });
        j++;
      } else if (i < a.length && (j === b.length || table[i + 1][j] >= table[i][j + 1])) {
        changes.push({ type: "removed", text: a[i++] });
      } else {
        changes.push({ type: "added", text: b[j++] });
      }
    }
    return changes;
  }

  function parseCents(value) {
    const match = String(value).match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) throw new TypeError("Use a decimal amount with at most two decimal places.");
    const cents = BigInt(match[2]) * 100n + BigInt((match[3] || "").padEnd(2, "0"));
    if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Amount is outside the supported range.");
    return Number(match[1] ? -cents : cents);
  }

  function parseTrafficPattern(value) {
    if (!value.trim()) return [];
    const parts = value.split(",").map((part) => part.trim());
    if (parts.length > 30 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 100)) {
      throw new RangeError("Use up to 30 comma-separated whole numbers from 0 to 100.");
    }
    return parts.map(Number);
  }

  function evaluateText(baseline, candidate, requiredPhrases = "") {
    validateComparisonText(baseline);
    validateComparisonText(candidate);
    if (requiredPhrases.length > 504) throw new RangeError("Use up to five required phrases of 100 characters each.");
    const phrases = [...new Set(requiredPhrases.split(/\r?\n/).map((phrase) => phrase.trim()).filter(Boolean))];
    if (phrases.length > 5 || phrases.some((phrase) => phrase.length > 100)) throw new RangeError("Use up to five required phrases of 100 characters each.");
    return phrases.map((phrase) => ({ label: `Contains “${phrase}” (case-sensitive)`, baseline: baseline.includes(phrase), candidate: candidate.includes(phrase) }));
  }

  function parseRecordsCSV(input) {
    if (typeof input !== "string" || input.length > DEMO_LIMITS.csvCharacters) throw new RangeError(`Keep each CSV within ${DEMO_LIMITS.csvCharacters} characters.`);
    const text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const rows = [];
    let row = [], field = "", quoted = false, closed = false;
    const addField = () => { row.push(field); field = ""; closed = false; };
    const addRow = () => {
      addField();
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      if (rows.length > DEMO_LIMITS.csvRecords + 1) throw new RangeError(`Use no more than ${DEMO_LIMITS.csvRecords} records per CSV.`);
    };
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
        else if (char === '"') { quoted = false; closed = true; }
        else field += char;
      } else if (char === ",") addField();
      else if (char === "\n") addRow();
      else if (closed) {
        if (!/[ \t]/.test(char)) throw new TypeError("Unexpected text after a closing CSV quote.");
      } else if (char === '"') {
        if (field.length) throw new TypeError("CSV quotes must begin at the start of a field.");
        quoted = true;
      } else field += char;
    }
    if (quoted) throw new TypeError("A quoted CSV field is not closed.");
    if (field.length || row.length || closed) addRow();
    const header = rows.shift();
    if (!header || header.length !== 2 || header[0].trim().toLowerCase() !== "id" || header[1].trim().toLowerCase() !== "amount") throw new TypeError("Start each CSV with the header id,amount.");
    return rows.map((cells, index) => {
      if (cells.length !== 2) throw new TypeError(`Record ${index + 1} must have exactly two columns: id and amount.`);
      const id = cells[0].trim();
      if (!id || id.length > 80 || /[\u0000-\u001f\u007f]/.test(id)) throw new TypeError(`Record ${index + 1} needs an ID of 1–80 characters without line breaks or control characters.`);
      try { return { id, cents: parseCents(cells[1].trim()) }; }
      catch (error) { throw new TypeError(`Record ${index + 1}: ${error.message}`); }
    });
  }

  function reconcileRecords(expected, actual) {
    const group = (rows) => {
      const map = new Map();
      for (const row of rows) {
        if (!Number.isSafeInteger(row.cents)) throw new TypeError("Money must be stored as integer cents.");
        if (!map.has(row.id)) map.set(row.id, []);
        map.get(row.id).push(row);
      }
      return map;
    };
    const left = group(expected);
    const right = group(actual);
    const ids = [...new Set([...left.keys(), ...right.keys()])].sort();
    const issues = [];
    let matched = 0;
    for (const id of ids) {
      const a = left.get(id) || [];
      const b = right.get(id) || [];
      if (a.length > 1 || b.length > 1) {
        issues.push({ id, type: "duplicate", expectedCount: a.length, actualCount: b.length });
      } else if (!a.length || !b.length) {
        issues.push({ id, type: "missing", side: a.length ? "export" : "ledger" });
      } else if (a[0].cents !== b[0].cents) {
        const difference = b[0].cents - a[0].cents;
        if (!Number.isSafeInteger(difference)) throw new RangeError("An amount difference is outside the supported exact-cent range.");
        issues.push({ id, type: "amount", expected: a[0].cents, actual: b[0].cents, difference });
      } else {
        matched++;
      }
    }
    return { matched, issues };
  }

  const renderRecordsTable = (rows, caption) => `<table class="reconcile-table"><caption class="visually-hidden">${escapeHTML(caption)}</caption><thead><tr><th scope="col">Record</th><th scope="col">Amount</th></tr></thead><tbody>${rows.map((row) => `<tr><th scope="row">${escapeHTML(row.id)}</th><td>${money(row.cents)}</td></tr>`).join("")}</tbody></table>`;
  const renderReconcileIssues = (issues) => issues.map((issue) => {
    const detail = issue.type === "amount" ? `Amount mismatch: expected ${money(issue.expected)}, received ${money(issue.actual)}. Difference: ${money(issue.difference)}.` : issue.type === "missing" ? `Missing from the ${issue.side}.` : `${issue.expectedCount} copies in the ledger; ${issue.actualCount} in the export. Duplicate IDs need review.`;
    return `<li><strong>${escapeHTML(issue.id)}</strong><span>${detail}</span></li>`;
  }).join("");

  const evalFixtures = [
    {
      id: "refund", label: "A promise changed", prompt: "Explain the sample store’s refund timing.",
      baseline: "Your refund will arrive in 5–7 business days. Contact support if it takes longer.",
      candidate: "Your refund will arrive in 24 hours. Contact support if it takes longer.",
      checks: [
        { label: "Keeps the approved 5–7 business day window", test: (text) => text.includes("5–7 business days") },
        { label: "Includes a support fallback", test: (text) => /contact support/i.test(text) },
        { label: "Stays under 140 characters", test: (text) => text.length < 140 },
      ],
    },
    {
      id: "json", label: "A valid confidence update", prompt: "Return a sentiment label and a confidence score as JSON.",
      baseline: '{ "sentiment": "positive", "confidence": 0.92 }',
      candidate: '{ "sentiment": "positive", "confidence": 0.95 }',
      checks: [
        { label: "Parses as valid JSON", test: (text) => { try { JSON.parse(text); return true; } catch { return false; } } },
        { label: "Uses a supported sentiment label", test: (text) => { try { return ["positive", "neutral", "negative"].includes(JSON.parse(text).sentiment); } catch { return false; } } },
        { label: "Confidence is a number from 0 to 1", test: (text) => { try { const n = JSON.parse(text).confidence; return typeof n === "number" && n >= 0 && n <= 1; } catch { return false; } } },
      ],
    },
    {
      id: "fallback", label: "An unsupported answer", prompt: "Answer using only the sample documents, which contain no storage limit.",
      baseline: "I could not find that answer in the provided documents.",
      candidate: "The subscription always includes unlimited storage.",
      checks: [
        { label: "Acknowledges the missing information", test: (text) => /could not find/i.test(text) },
        { label: "Avoids the unsupported unlimited-storage claim", test: (text) => !/unlimited storage/i.test(text) },
        { label: "Stays under 140 characters", test: (text) => text.length < 140 },
      ],
    },
  ];
  const evaluateFixture = (id) => {
    const fixture = evalFixtures.find((item) => item.id === id);
    if (!fixture) throw new RangeError("Unknown sample fixture.");
    return fixture.checks.map((check) => ({ label: check.label, baseline: check.test(fixture.baseline), candidate: check.test(fixture.candidate) }));
  };

  const logic = Object.freeze({ emptyQueue, stepQueue, diffWords, parseCents, reconcileRecords, evaluateFixture, evaluateText, parseRecordsCSV, parseTrafficPattern, renderRecordsTable, renderReconcileIssues, DEMO_LIMITS });
  if (typeof module !== "undefined" && module.exports) module.exports = logic;
  global.portfolioDemoLogic = logic;
  if (!global.document) return;

  const doc = global.document;
  const projects = {
    batchline: { number: "01", name: "Batchline", category: "INFERENCE LAB", color: "amber", description: "A tiny model with a real serving problem: how to handle bursts of requests without an ever-growing queue.", detail: "Build your own traffic pattern and find the point where a bounded queue starts protecting the service.", footnote: "A queue simulation that runs on your device. It does not send traffic to a model service.", render: renderBatchline },
    evaldeck: { number: "02", name: "EvalDeck", category: "AI EVALUATION", color: "cyan", description: "A repeatable way to compare AI outputs, spot changes, and catch regressions before shipping a new version.", detail: "Compare your own answers with explicit phrase checks, or explore a sample regression.", footnote: "Text comparison and checks run on your device. Your text is not uploaded and no language model is called.", render: renderEvalDeck },
    "reconcile-kit": { number: "03", name: "Reconcile Kit", category: "DATA TOOLING", color: "coral", description: "A reconciliation tool for finding missing records, duplicates, and exact-money mismatches in exported data.", detail: "Paste two CSV exports and compare every record using exact integer cents.", footnote: "CSV parsing and reconciliation run on your device. Your records are not uploaded or saved.", render: renderReconcile },
    "prism-studio": { number: "04", name: "Prism Studio", category: "IMAGE WORKBENCH", color: "green", description: "An image workbench that keeps the seed and settings alongside each experiment so good results can be revisited.", detail: "Prepare a prompt and seed for a future image-generation experiment.", footnote: "Local prototype. AWS is disconnected and no paid image generation is available.", render: (root) => typeof global.PortfolioLivePrism === "function" ? global.PortfolioLivePrism(root) : renderPrism(root) },
  };
  let dialog;
  let cleanupDemo = () => {};
  let lastTrigger;
  let activeProject = null;

  function ensureDialog() {
    if (dialog) return;
    dialog = doc.createElement("dialog");
    dialog.className = "playground-dialog";
    dialog.id = "project-playground";
    dialog.setAttribute("aria-labelledby", "playground-title");
    dialog.setAttribute("aria-describedby", "playground-description");
    doc.body.append(dialog);
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
    });
    dialog.addEventListener("close", () => { if (!dialog.open && activeProject) finishClose(); });
  }

  function finishClose() {
    cleanupDemo();
    cleanupDemo = () => {};
    activeProject = null;
    doc.body.classList.remove("playground-open");
    if (lastTrigger?.isConnected && !doc.querySelector("dialog[open]")) lastTrigger.focus({ preventScroll: true });
    global.dispatchEvent(new CustomEvent("portfolio:playground-close"));
  }

  function close() {
    if (!dialog?.open) return false;
    dialog.close();
    finishClose();
    return true;
  }

  function open(id, trigger = doc.activeElement) {
    const project = projects[id];
    if (!project) return false;
    ensureDialog();
    if (!dialog.open) lastTrigger = trigger;
    cleanupDemo();
    activeProject = id;
    dialog.dataset.color = project.color;
    dialog.innerHTML = `
      <div class="playground-topbar"><span><span class="playground-power" aria-hidden="true"></span> CARTRIDGE ${project.number}</span><button class="playground-close" type="button" aria-label="Close ${project.name} preview" autofocus>Close <span aria-hidden="true">×</span></button></div>
      <div class="playground-content">
        <header class="playground-intro"><p class="playground-eyebrow">${project.category}</p><h2 id="playground-title">${project.name}</h2><p id="playground-description">${project.description}</p><p class="playground-detail">${project.detail}</p>
          <div class="playground-links"><a class="demo-button demo-button-primary" href="#playground-demo" data-try-demo>Try it <span aria-hidden="true">↓</span></a><a class="demo-button" href="https://github.com/elliottbarnes/${id}" target="_blank" rel="noopener">View source <span aria-hidden="true">↗</span><span class="visually-hidden"> (opens in a new tab)</span></a></div>
        </header>
        <section class="playground-screen" id="playground-demo" aria-label="${project.name} interactive demo" tabindex="-1"></section>
        <p class="playground-footnote">${project.footnote}</p>
      </div>`;
    dialog.querySelector(".playground-close").addEventListener("click", close);
    dialog.querySelector("[data-try-demo]").addEventListener("click", (event) => {
      event.preventDefault();
      const screen = dialog.querySelector(".playground-screen");
      const reduceMotion = doc.documentElement.dataset.motion === "reduced" || global.matchMedia("(prefers-reduced-motion: reduce)").matches;
      screen.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      screen.querySelector("input, textarea, select, button")?.focus({ preventScroll: true });
    });
    cleanupDemo = project.render(dialog.querySelector(".playground-screen")) || (() => {});
    doc.body.classList.add("playground-open");
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    global.dispatchEvent(new CustomEvent("portfolio:playground-open", { detail: { id } }));
    return true;
  }

  doc.addEventListener("click", (event) => {
    const card = event.target.closest?.(".project-card[data-project]");
    if (!card || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (open(card.dataset.project, card)) event.preventDefault();
  });
  global.portfolioPlayground = Object.freeze({ open, close, isOpen: () => Boolean(dialog?.open) });

  function renderBatchline(root) {
    root.innerHTML = `
      <div class="demo-heading"><p class="playground-eyebrow">TRAFFIC CONTROL</p><h3>Make a little rush hour.</h3><p>Each step admits requests into an 18-slot queue, then processes up to your service rate. Extra arrivals are rejected.</p></div>
      <div class="demo-sliders">
        <label class="demo-slider" for="batch-arrivals"><span>Incoming requests <output id="batch-arrivals-value" for="batch-arrivals">6 / step</output></span><input id="batch-arrivals" type="range" min="0" max="12" value="6" step="1"><span class="demo-range-ends"><span>Quiet · 0</span><span>Busy · 12</span></span></label>
        <label class="demo-slider" for="batch-workers"><span>Service rate <output id="batch-workers-value" for="batch-workers">4 / step</output></span><input id="batch-workers" type="range" min="1" max="8" value="4" step="1"><span class="demo-range-ends"><span>Slow · 1</span><span>Fast · 8</span></span></label>
      </div>
      <label class="demo-field batch-pattern" for="batch-pattern">Repeating traffic pattern (optional)<input id="batch-pattern" type="text" maxlength="119" placeholder="6, 6, 12, 0" aria-describedby="batch-pattern-help" autocomplete="off"><span class="demo-note" id="batch-pattern-help">Up to 30 comma-separated arrivals from 0 to 100. Leave empty to use the traffic slider. Changing a pattern pauses the simulation.</span></label>
      <div class="batch-queue-panel"><div class="batch-queue-label"><strong>Waiting room</strong><span data-batch-queue-label>0 / 18 slots</span></div><div class="batch-queue" aria-hidden="true">${Array.from({ length: 18 }, () => '<span class="batch-slot"></span>').join("")}</div><p class="demo-note" data-batch-insight>The queue is empty. Take a step to let requests in.</p></div>
      <dl class="demo-metrics"><div><dt>Steps</dt><dd data-batch-tick>0</dd></div><div><dt>Completed</dt><dd data-batch-completed>0</dd></div><div><dt>Rejected</dt><dd data-batch-rejected>0</dd></div></dl>
      <div class="demo-actions"><button class="demo-button demo-button-primary" type="button" data-batch-step>Step once</button><button class="demo-button" type="button" data-batch-run aria-pressed="false">Run simulation</button><button class="demo-button" type="button" data-batch-reset>Reset</button></div>
      <p class="demo-status" role="status" data-batch-status>Ready. Nothing runs until you start it.</p>`;
    let state = emptyQueue();
    let timer = null;
    const arrivals = root.querySelector("#batch-arrivals");
    const workers = root.querySelector("#batch-workers");
    const patternInput = root.querySelector("#batch-pattern");
    const status = root.querySelector("[data-batch-status]");
    const run = root.querySelector("[data-batch-run]");
    const step = root.querySelector("[data-batch-step]");
    let pattern = [];
    const paint = () => {
      root.querySelector("[data-batch-queue-label]").textContent = `${state.queued} / 18 slots`;
      root.querySelectorAll(".batch-slot").forEach((slot, index) => { slot.classList.toggle("is-filled", index < state.queued); });
      for (const metric of ["tick", "completed", "rejected"]) root.querySelector(`[data-batch-${metric}]`).textContent = state[metric];
      root.querySelector("[data-batch-insight]").textContent = state.tick === 0
        ? "The queue is empty. Take a step to let requests in."
        : state.queued === 0 ? "All caught up. Try more traffic than your service rate."
          : Number(arrivals.value) > Number(workers.value) ? "Traffic is arriving faster than it can be processed. The waiting room fills until extra requests are rejected."
            : "There is room to catch up. Lower incoming traffic to drain the queue.";
      if (pattern.length && patternInput.value.trim() && state.tick > 0) root.querySelector("[data-batch-insight]").textContent = `Repeating ${pattern.join(", ")} arrivals. Next step: ${pattern[state.tick % pattern.length]} arrivals; ${state.queued} requests are waiting.`;
    };
    const tick = () => {
      state = stepQueue(state, pattern.length ? pattern[state.tick % pattern.length] : arrivals.value, workers.value);
      paint();
    };
    const pause = () => {
      global.clearInterval(timer);
      timer = null;
      run.textContent = "Run simulation";
      run.setAttribute("aria-pressed", "false");
      step.disabled = false;
    };
    const readPattern = () => {
      try { pattern = parseTrafficPattern(patternInput.value); return true; }
      catch (error) { status.textContent = error.message; return false; }
    };
    patternInput.addEventListener("input", () => { pause(); status.textContent = "Pattern updated. Reset to start at its first step, or continue from the current step."; });
    for (const [input, output] of [[arrivals, "#batch-arrivals-value"], [workers, "#batch-workers-value"]]) {
      input.addEventListener("input", () => {
        root.querySelector(output).textContent = `${input.value} / step`;
        input.setAttribute("aria-valuetext", `${input.value} requests per step`);
        paint();
      });
      input.setAttribute("aria-valuetext", `${input.value} requests per step`);
    }
    step.addEventListener("click", () => {
      if (!readPattern()) return;
      tick();
      status.textContent = `Step ${state.tick}: ${state.queued} waiting, ${state.completed} completed, ${state.rejected} rejected in total.`;
    });
    run.addEventListener("click", () => {
      if (timer !== null) {
        pause();
        status.textContent = `Paused after ${state.tick} steps. ${state.queued} waiting, ${state.completed} completed, ${state.rejected} rejected.`;
      } else {
        if (!readPattern()) return;
        tick();
        timer = global.setInterval(tick, 950);
        run.textContent = "Pause simulation";
        run.setAttribute("aria-pressed", "true");
        step.disabled = true;
        status.textContent = "Running one step per second. Pause to inspect the totals.";
      }
    });
    root.querySelector("[data-batch-reset]").addEventListener("click", () => { pause(); state = emptyQueue(); paint(); status.textContent = "Queue and totals reset. Your traffic settings are preserved."; });
    const onVisibility = () => { if (doc.hidden && timer !== null) { pause(); status.textContent = "Paused while this page is in the background."; } };
    doc.addEventListener("visibilitychange", onVisibility);
    return () => { pause(); doc.removeEventListener("visibilitychange", onVisibility); };
  }

  function renderEvalDeck(root) {
    root.innerHTML = `
      <div class="demo-heading"><p class="playground-eyebrow">SPOT THE REGRESSION</p><h3>Your text. Explicit checks.</h3><p>Compare answers and check required phrases directly in your browser. These checks do not judge factual accuracy or call a language model.</p></div>
      <label class="demo-select-label" for="eval-fixture">Choose an example or use your own text<select id="eval-fixture">${evalFixtures.map((fixture) => `<option value="${fixture.id}">${fixture.label}</option>`).join("")}<option value="custom">Use my own text</option></select></label>
      <p class="eval-prompt" data-eval-prompt-wrap><strong>Sample prompt</strong><span data-eval-prompt></span></p>
      <div class="demo-editor" data-eval-editor hidden>
        <p class="demo-note" id="eval-limits">Each answer: up to 4,000 characters and 300 words. Nothing is uploaded.</p>
        <div class="demo-input-pair"><label class="demo-field" for="eval-baseline-input">Baseline answer<textarea id="eval-baseline-input" rows="6" maxlength="4000" aria-describedby="eval-limits" spellcheck="false"></textarea></label><label class="demo-field" for="eval-candidate-input">Candidate answer<textarea id="eval-candidate-input" rows="6" maxlength="4000" aria-describedby="eval-limits" spellcheck="false"></textarea></label></div>
        <label class="demo-field" for="eval-phrases">Required phrases (optional)<textarea id="eval-phrases" rows="3" maxlength="504" aria-describedby="eval-phrase-help" spellcheck="false"></textarea></label><p class="demo-note" id="eval-phrase-help">One exact, case-sensitive phrase per line. Up to five phrases, 100 characters each. Leave empty to compare text only.</p>
      </div>
      <div class="eval-outputs" data-eval-outputs><section><h4>Baseline</h4><p class="eval-output" data-eval-baseline></p></section><section><h4>Candidate</h4><p class="eval-output" data-eval-candidate></p></section></div>
      <div class="demo-actions"><button class="demo-button demo-button-primary" type="button" data-eval-reveal aria-pressed="false">Reveal changes &amp; checks</button></div>
      <div data-eval-results hidden><p class="eval-legend"><span><del>Removed</del> from baseline</span><span><ins>Added</ins> in candidate</span></p><ul class="eval-checks" data-eval-checks></ul></div>
      <p class="demo-status" role="status" data-eval-status>Choose a sample or compare your own text.</p>`;
    const selector = root.querySelector("#eval-fixture");
    const baselineInput = root.querySelector("#eval-baseline-input");
    const candidateInput = root.querySelector("#eval-candidate-input");
    const phrasesInput = root.querySelector("#eval-phrases");
    const reveal = root.querySelector("[data-eval-reveal]");
    const results = root.querySelector("[data-eval-results]");
    const outputs = root.querySelector("[data-eval-outputs]");
    const status = root.querySelector("[data-eval-status]");
    let revealed = false;
    baselineInput.value = evalFixtures[0].baseline;
    candidateInput.value = evalFixtures[0].candidate;
    phrasesInput.value = "5–7 business days";
    const paint = () => {
      const custom = selector.value === "custom";
      const fixture = evalFixtures.find((item) => item.id === selector.value) || evalFixtures[0];
      root.querySelector("[data-eval-editor]").hidden = !custom;
      root.querySelector("[data-eval-prompt-wrap]").hidden = custom;
      root.querySelector("[data-eval-prompt]").textContent = fixture.prompt;
      const baseline = custom ? baselineInput.value : fixture.baseline;
      const candidate = custom ? candidateInput.value : fixture.candidate;
      const checks = revealed ? custom ? evaluateText(baseline, candidate, phrasesInput.value) : evaluateFixture(fixture.id) : [];
      const diff = revealed ? diffWords(baseline, candidate) : [];
      for (const [side, text, excluded, highlight, tag] of [["baseline", baseline, "added", "removed", "del"], ["candidate", candidate, "removed", "added", "ins"]]) {
        const output = root.querySelector(`[data-eval-${side}]`);
        if (!revealed) output.textContent = text;
        else output.innerHTML = diff.filter((item) => item.type !== excluded).map((item) => item.type === highlight ? `<${tag}>${escapeHTML(item.text)}</${tag}>` : escapeHTML(item.text)).join("");
      }
      const failed = checks.filter((check) => !check.candidate).length;
      root.querySelector("[data-eval-checks]").innerHTML = checks.map((check) => `<li><span class="eval-check-icon ${check.candidate ? "is-pass" : "is-fail"}" aria-hidden="true">${check.candidate ? "✓" : "!"}</span><span>${escapeHTML(check.label)}<small>Baseline: ${check.baseline ? "pass" : "fail"} · Candidate: ${check.candidate ? "pass" : "fail"}</small></span></li>`).join("");
      outputs.hidden = custom && !revealed;
      reveal.textContent = revealed ? "Hide comparison" : custom ? "Compare text & checks" : "Reveal changes & checks";
      reveal.setAttribute("aria-pressed", String(revealed));
      results.hidden = !revealed;
      status.textContent = !revealed ? custom ? "Edit the answers and required phrases, then compare." : "Choose a sample, then reveal what changed." : !checks.length ? "Text compared. No required phrases were specified; no quality checks were run." : failed ? `${failed} of ${checks.length} candidate checks failed. Review the differences below.` : `All ${checks.length} candidate checks passed. This only confirms the displayed checks.`;
    };
    selector.addEventListener("change", () => { revealed = false; paint(); });
    for (const field of [baselineInput, candidateInput, phrasesInput]) field.addEventListener("input", () => { revealed = false; paint(); });
    reveal.addEventListener("click", () => {
      revealed = !revealed;
      try { paint(); }
      catch (error) { revealed = false; paint(); status.textContent = error.message; }
    });
    paint();
  }

  function renderReconcile(root) {
    const sampleLedger = [{ id: "A-101", cents: 12450 }, { id: "A-102", cents: 3000 }, { id: "A-103", cents: 1899 }, { id: "A-104", cents: 7525 }];
    root.innerHTML = `
      <div class="demo-heading"><p class="playground-eyebrow">FOLLOW THE CENTS</p><h3>Your records. Every cent counts.</h3><p>Compare two CSV exports on your device, or try the sample ledger. Amounts are checked as exact integer cents without rounding.</p></div>
      <label class="demo-select-label" for="reconcile-mode">Choose records<select id="reconcile-mode"><option value="sample">Try sample records</option><option value="custom">Paste my own CSV</option></select></label>
      <fieldset class="reconcile-options" data-reconcile-options><legend>Add a sample export problem</legend><label><input type="checkbox" value="amount" checked><span>Change A-103 by one cent</span></label><label><input type="checkbox" value="missing"><span>Remove A-102</span></label><label><input type="checkbox" value="duplicate"><span>Duplicate A-104</span></label></fieldset>
      <div class="demo-editor" data-reconcile-editor hidden><p class="demo-note" id="reconcile-csv-help">Use the header id,amount and decimal amounts such as 18.99. Each CSV may contain up to 200 records and 20,000 characters. Quoted IDs are supported. Data stays on this device.</p><div class="demo-input-pair"><label class="demo-field" for="reconcile-ledger-input">Original ledger CSV<textarea id="reconcile-ledger-input" rows="7" maxlength="20000" aria-describedby="reconcile-csv-help" spellcheck="false" autocapitalize="off"></textarea></label><label class="demo-field" for="reconcile-export-input">Incoming export CSV<textarea id="reconcile-export-input" rows="7" maxlength="20000" aria-describedby="reconcile-csv-help" spellcheck="false" autocapitalize="off"></textarea></label></div></div>
      <div class="reconcile-tables" data-reconcile-tables><section><h4>Original ledger</h4><div class="reconcile-table-scroll" data-reconcile-ledger></div></section><section><h4>Incoming export</h4><div class="reconcile-table-scroll" data-reconcile-export></div></section></div>
      <div class="demo-actions"><button class="demo-button demo-button-primary" type="button" data-reconcile-check>Reconcile records</button><button class="demo-button" type="button" data-reconcile-reset>Clear sample problems</button></div>
      <p class="demo-status" role="status" data-reconcile-status>One cent has changed. Can you spot it?</p><ul class="reconcile-results" data-reconcile-results hidden></ul>`;
    const mode = root.querySelector("#reconcile-mode");
    const controls = [...root.querySelectorAll(".reconcile-options input")];
    const ledgerInput = root.querySelector("#reconcile-ledger-input");
    const exportInput = root.querySelector("#reconcile-export-input");
    const tables = root.querySelector("[data-reconcile-tables]");
    const results = root.querySelector("[data-reconcile-results]");
    const status = root.querySelector("[data-reconcile-status]");
    const reset = root.querySelector("[data-reconcile-reset]");
    ledgerInput.value = "id,amount\nA-101,124.50\nA-102,30.00\nA-103,18.99\nA-104,75.25";
    exportInput.value = ledgerInput.value.replace("18.99", "19.00");
    let ledger = sampleLedger, records = [];
    const hideResults = () => { results.hidden = true; results.replaceChildren(); };
    const paintTables = () => {
      root.querySelector("[data-reconcile-ledger]").innerHTML = renderRecordsTable(ledger, "Original ledger");
      root.querySelector("[data-reconcile-export]").innerHTML = renderRecordsTable(records, "Incoming export");
      tables.hidden = false;
    };
    const paint = () => {
      const custom = mode.value === "custom";
      root.querySelector("[data-reconcile-editor]").hidden = !custom;
      root.querySelector("[data-reconcile-options]").hidden = custom;
      reset.hidden = custom;
      hideResults();
      if (custom) { tables.hidden = true; return; }
      const enabled = new Set(controls.filter((input) => input.checked).map((input) => input.value));
      ledger = sampleLedger;
      records = ledger.map((row) => ({ ...row }));
      if (enabled.has("amount")) records.find((row) => row.id === "A-103").cents++;
      if (enabled.has("missing")) records = records.filter((row) => row.id !== "A-102");
      if (enabled.has("duplicate")) records.push({ ...ledger[3] });
      paintTables();
    };
    mode.addEventListener("change", () => { paint(); status.textContent = mode.value === "custom" ? "Paste both CSV exports, then reconcile. Your inputs are not uploaded." : "Sample records loaded. Reconcile to check them."; });
    controls.forEach((input) => input.addEventListener("change", () => { paint(); status.textContent = "Export updated. Reconcile again to check it."; }));
    for (const field of [ledgerInput, exportInput]) field.addEventListener("input", () => { hideResults(); tables.hidden = true; status.textContent = "CSV updated. Reconcile again to check it."; });
    root.querySelector("[data-reconcile-check]").addEventListener("click", () => {
      hideResults();
      try {
        if (mode.value === "custom") {
          try { ledger = parseRecordsCSV(ledgerInput.value); }
          catch (error) { throw new TypeError(`Original ledger: ${error.message}`); }
          try { records = parseRecordsCSV(exportInput.value); }
          catch (error) { throw new TypeError(`Incoming export: ${error.message}`); }
        }
        const report = reconcileRecords(ledger, records);
        paintTables();
        status.textContent = report.issues.length ? `${report.issues.length} issue${report.issues.length === 1 ? "" : "s"} found. ${report.matched} record${report.matched === 1 ? "" : "s"} matched exactly.` : `${report.matched} records matched exactly. No missing records, duplicates, or amount differences.`;
        results.innerHTML = renderReconcileIssues(report.issues);
        results.hidden = report.issues.length === 0;
      } catch (error) { tables.hidden = true; status.textContent = error.message; }
    });
    reset.addEventListener("click", () => { controls.forEach((input) => { input.checked = false; }); paint(); status.textContent = "Problems cleared. Reconcile to verify the clean export."; });
    paint();
  }

  function renderPrism(root) {
    root.innerHTML = '<p class="demo-status" role="status">The image prototype could not load. Reload the page to try again. AWS generation remains disconnected.</p>';
  }

})(typeof window !== "undefined" ? window : globalThis);
