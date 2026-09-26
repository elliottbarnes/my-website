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

  function diffWords(before, after) {
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
    const cents = Number(match[2]) * 100 + Number((match[3] || "").padEnd(2, "0"));
    if (!Number.isSafeInteger(cents)) throw new RangeError("Amount is outside the supported range.");
    return match[1] ? -cents : cents;
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
        issues.push({ id, type: "amount", expected: a[0].cents, actual: b[0].cents, difference: b[0].cents - a[0].cents });
      } else {
        matched++;
      }
    }
    return { matched, issues };
  }

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

  const logic = Object.freeze({ emptyQueue, stepQueue, diffWords, parseCents, reconcileRecords, evaluateFixture });
  if (typeof module !== "undefined" && module.exports) module.exports = logic;
  global.portfolioDemoLogic = logic;
  if (!global.document) return;

  const doc = global.document;
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const money = (cents) => `${cents < 0 ? "−" : ""}$${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
  const projects = {
    batchline: { number: "01", name: "Batchline", category: "INFERENCE LAB", color: "amber", description: "A tiny model with a real serving problem: how to handle bursts of requests without an ever-growing queue.", detail: "Turn up the traffic and find the point where a bounded queue starts protecting the service.", render: renderBatchline },
    evaldeck: { number: "02", name: "EvalDeck", category: "AI EVALUATION", color: "cyan", description: "A repeatable way to compare AI outputs, spot changes, and catch regressions before shipping a new version.", detail: "Inspect saved sample answers and see why a small wording change can matter.", render: renderEvalDeck },
    "reconcile-kit": { number: "03", name: "Reconcile Kit", category: "DATA TOOLING", color: "coral", description: "A reconciliation tool for finding missing records, duplicates, and exact-money mismatches in exported data.", detail: "Introduce a few problems into a synthetic export, then check it against the ledger.", render: renderReconcile },
    "prism-studio": { number: "04", name: "Prism Studio", category: "IMAGE WORKBENCH", color: "green", description: "A local image workbench that keeps the seed and settings alongside each experiment so good results can be revisited.", detail: "Explore a small illustrative seed gallery and see what a saved experiment looks like.", render: renderPrism },
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
        <p class="playground-footnote">A small browser demo of the idea. Runs on your device with sample data.</p>
      </div>`;
    dialog.querySelector(".playground-close").addEventListener("click", close);
    dialog.querySelector("[data-try-demo]").addEventListener("click", (event) => {
      event.preventDefault();
      const screen = dialog.querySelector(".playground-screen");
      const reduceMotion = doc.documentElement.dataset.motion === "reduced" || global.matchMedia("(prefers-reduced-motion: reduce)").matches;
      screen.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      screen.querySelector("input, select, button")?.focus({ preventScroll: true });
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
      <div class="batch-queue-panel"><div class="batch-queue-label"><strong>Waiting room</strong><span data-batch-queue-label>0 / 18 slots</span></div><div class="batch-queue" aria-hidden="true">${Array.from({ length: 18 }, () => '<span class="batch-slot"></span>').join("")}</div><p class="demo-note" data-batch-insight>The queue is empty. Take a step to let requests in.</p></div>
      <dl class="demo-metrics"><div><dt>Steps</dt><dd data-batch-tick>0</dd></div><div><dt>Completed</dt><dd data-batch-completed>0</dd></div><div><dt>Rejected</dt><dd data-batch-rejected>0</dd></div></dl>
      <div class="demo-actions"><button class="demo-button demo-button-primary" type="button" data-batch-step>Step once</button><button class="demo-button" type="button" data-batch-run aria-pressed="false">Run simulation</button><button class="demo-button" type="button" data-batch-reset>Reset</button></div>
      <p class="demo-status" role="status" data-batch-status>Ready. Nothing runs until you start it.</p>`;
    let state = emptyQueue();
    let timer = null;
    const arrivals = root.querySelector("#batch-arrivals");
    const workers = root.querySelector("#batch-workers");
    const status = root.querySelector("[data-batch-status]");
    const run = root.querySelector("[data-batch-run]");
    const step = root.querySelector("[data-batch-step]");
    const paint = () => {
      root.querySelector("[data-batch-queue-label]").textContent = `${state.queued} / 18 slots`;
      root.querySelectorAll(".batch-slot").forEach((slot, index) => { slot.classList.toggle("is-filled", index < state.queued); });
      for (const metric of ["tick", "completed", "rejected"]) root.querySelector(`[data-batch-${metric}]`).textContent = state[metric];
      root.querySelector("[data-batch-insight]").textContent = state.tick === 0
        ? "The queue is empty. Take a step to let requests in."
        : state.queued === 0 ? "All caught up. Try more traffic than your service rate."
          : Number(arrivals.value) > Number(workers.value) ? "Traffic is arriving faster than it can be processed. The waiting room fills until extra requests are rejected."
            : "There is room to catch up. Lower incoming traffic to drain the queue.";
    };
    const tick = () => { state = stepQueue(state, arrivals.value, workers.value); paint(); };
    const pause = () => {
      global.clearInterval(timer);
      timer = null;
      run.textContent = "Run simulation";
      run.setAttribute("aria-pressed", "false");
      step.disabled = false;
    };
    for (const [input, output] of [[arrivals, "#batch-arrivals-value"], [workers, "#batch-workers-value"]]) {
      input.addEventListener("input", () => {
        root.querySelector(output).textContent = `${input.value} / step`;
        input.setAttribute("aria-valuetext", `${input.value} requests per step`);
        paint();
      });
      input.setAttribute("aria-valuetext", `${input.value} requests per step`);
    }
    step.addEventListener("click", () => {
      tick();
      status.textContent = `Step ${state.tick}: ${state.queued} waiting, ${state.completed} completed, ${state.rejected} rejected in total.`;
    });
    run.addEventListener("click", () => {
      if (timer !== null) {
        pause();
        status.textContent = `Paused after ${state.tick} steps. ${state.queued} waiting, ${state.completed} completed, ${state.rejected} rejected.`;
      } else {
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
      <div class="demo-heading"><p class="playground-eyebrow">SPOT THE REGRESSION</p><h3>Same prompt. New answer.</h3><p>These are fixed sample outputs with simple, explicit checks. No model is running.</p></div>
      <label class="demo-select-label" for="eval-fixture">Choose a sample<select id="eval-fixture">${evalFixtures.map((fixture) => `<option value="${fixture.id}">${fixture.label}</option>`).join("")}</select></label>
      <p class="eval-prompt"><strong>Prompt</strong><span data-eval-prompt></span></p>
      <div class="eval-outputs"><section><h4>Baseline</h4><p class="eval-output" data-eval-baseline></p></section><section><h4>Candidate</h4><p class="eval-output" data-eval-candidate></p></section></div>
      <div class="demo-actions"><button class="demo-button demo-button-primary" type="button" data-eval-reveal aria-pressed="false">Reveal changes &amp; checks</button></div>
      <div data-eval-results hidden><p class="eval-legend"><span><del>Removed</del> from baseline</span><span><ins>Added</ins> in candidate</span></p><ul class="eval-checks" data-eval-checks></ul></div>
      <p class="demo-status" role="status" data-eval-status>Choose a sample, then reveal what changed.</p>`;
    const selector = root.querySelector("#eval-fixture");
    const reveal = root.querySelector("[data-eval-reveal]");
    const results = root.querySelector("[data-eval-results]");
    const status = root.querySelector("[data-eval-status]");
    let revealed = false;
    const paint = () => {
      const fixture = evalFixtures.find((item) => item.id === selector.value);
      root.querySelector("[data-eval-prompt]").textContent = fixture.prompt;
      const diff = diffWords(fixture.baseline, fixture.candidate);
      for (const [side, excluded, highlight, tag] of [["baseline", "added", "removed", "del"], ["candidate", "removed", "added", "ins"]]) {
        const output = root.querySelector(`[data-eval-${side}]`);
        if (!revealed) output.textContent = fixture[side];
        else output.innerHTML = diff.filter((item) => item.type !== excluded).map((item) => item.type === highlight ? `<${tag}>${escapeHTML(item.text)}</${tag}>` : escapeHTML(item.text)).join("");
      }
      const checks = evaluateFixture(fixture.id);
      const failed = checks.filter((check) => !check.candidate).length;
      root.querySelector("[data-eval-checks]").innerHTML = checks.map((check) => `<li><span class="eval-check-icon ${check.candidate ? "is-pass" : "is-fail"}" aria-hidden="true">${check.candidate ? "✓" : "!"}</span><span>${check.label}<small>Baseline: ${check.baseline ? "pass" : "fail"} · Candidate: ${check.candidate ? "pass" : "fail"}</small></span></li>`).join("");
      reveal.textContent = revealed ? "Hide changes & checks" : "Reveal changes & checks";
      reveal.setAttribute("aria-pressed", String(revealed));
      results.hidden = !revealed;
      status.textContent = revealed ? failed ? `${failed} of ${checks.length} candidate checks failed. This sample has a regression.` : `All ${checks.length} candidate checks passed. A changed output is not always a regression.` : "Choose a sample, then reveal what changed.";
    };
    selector.addEventListener("change", () => { revealed = false; paint(); });
    reveal.addEventListener("click", () => { revealed = !revealed; paint(); });
    paint();
  }

  function renderReconcile(root) {
    const ledger = [{ id: "A-101", cents: 12450 }, { id: "A-102", cents: 3000 }, { id: "A-103", cents: 1899 }, { id: "A-104", cents: 7525 }];
    root.innerHTML = `
      <div class="demo-heading"><p class="playground-eyebrow">FOLLOW THE CENTS</p><h3>Four records. Every cent counts.</h3><p>Toggle problems in a synthetic export and compare it with the original ledger. Amounts are checked in integer cents.</p></div>
      <fieldset class="reconcile-options"><legend>Add an export problem</legend><label><input type="checkbox" value="amount" checked><span>Change A-103 by one cent</span></label><label><input type="checkbox" value="missing"><span>Remove A-102</span></label><label><input type="checkbox" value="duplicate"><span>Duplicate A-104</span></label></fieldset>
      <div class="reconcile-tables"><section><h4>Original ledger</h4><div data-reconcile-ledger></div></section><section><h4>Incoming export</h4><div data-reconcile-export></div></section></div>
      <div class="demo-actions"><button class="demo-button demo-button-primary" type="button" data-reconcile-check>Reconcile records</button><button class="demo-button" type="button" data-reconcile-reset>Clear problems</button></div>
      <p class="demo-status" role="status" data-reconcile-status>One cent has changed. Can you spot it?</p><ul class="reconcile-results" data-reconcile-results hidden></ul>`;
    const controls = [...root.querySelectorAll(".reconcile-options input")];
    const results = root.querySelector("[data-reconcile-results]");
    const status = root.querySelector("[data-reconcile-status]");
    let records = [];
    const renderTable = (rows, caption) => `<table class="reconcile-table"><caption class="visually-hidden">${caption}</caption><thead><tr><th scope="col">Record</th><th scope="col">Amount</th></tr></thead><tbody>${rows.map((row) => `<tr><th scope="row">${row.id}</th><td>${money(row.cents)}</td></tr>`).join("")}</tbody></table>`;
    const paint = () => {
      const enabled = new Set(controls.filter((input) => input.checked).map((input) => input.value));
      records = ledger.map((row) => ({ ...row }));
      if (enabled.has("amount")) records.find((row) => row.id === "A-103").cents++;
      if (enabled.has("missing")) records = records.filter((row) => row.id !== "A-102");
      if (enabled.has("duplicate")) records.push({ ...ledger[3] });
      root.querySelector("[data-reconcile-ledger]").innerHTML = renderTable(ledger, "Original ledger, four synthetic records");
      root.querySelector("[data-reconcile-export]").innerHTML = renderTable(records, "Incoming synthetic export");
      results.hidden = true;
      results.replaceChildren();
    };
    controls.forEach((input) => input.addEventListener("change", () => { paint(); status.textContent = "Export updated. Reconcile again to check it."; }));
    root.querySelector("[data-reconcile-check]").addEventListener("click", () => {
      const report = reconcileRecords(ledger, records);
      status.textContent = report.issues.length ? `${report.issues.length} issue${report.issues.length === 1 ? "" : "s"} found. ${report.matched} record${report.matched === 1 ? "" : "s"} matched exactly.` : "All four records matched exactly. No missing records, duplicates, or amount differences.";
      results.innerHTML = report.issues.map((issue) => {
        const detail = issue.type === "amount" ? `Amount mismatch: expected ${money(issue.expected)}, received ${money(issue.actual)}. Difference: ${money(issue.difference)}.` : issue.type === "missing" ? "Missing from the export." : `${issue.actualCount} copies in the export. Duplicate IDs need review.`;
        return `<li><strong>${issue.id}</strong><span>${detail}</span></li>`;
      }).join("");
      results.hidden = report.issues.length === 0;
    });
    root.querySelector("[data-reconcile-reset]").addEventListener("click", () => { controls.forEach((input) => { input.checked = false; }); paint(); status.textContent = "Problems cleared. Reconcile to verify the clean export."; });
    paint();
  }

  function renderPrism(root) {
    const seeds = [17, 42, 108];
    const captions = {
      17: "An amber-lit observatory above a lake under a starry blue sky",
      42: "An amber ringed planet with blue and sage moons in a starry sky",
      108: "A crescent moon reflected in a mountain lake beside pine trees",
    };
    root.innerHTML = `
      <div class="demo-heading"><p class="playground-eyebrow">THE SEED GALLERY</p><h3>Keep the experiment.</h3><p>Three pre-made illustrations stand in for saved runs. Choose a seed to explore the gallery.</p></div>
      <div class="prism-seeds" role="group" aria-label="Choose an illustrative seed">${seeds.map((seed, index) => `<button class="demo-button ${index === 0 ? "is-selected" : ""}" type="button" data-prism-seed="${seed}" aria-pressed="${index === 0}">Seed ${seed}</button>`).join("")}</div>
      <figure class="prism-art"><img src="/assets/prism/seed-17.jpg" alt="${captions[17]}" width="512" height="512" decoding="async" data-prism-image><div class="prism-image-error" hidden data-prism-error>Artwork could not load. Select another seed to keep exploring.</div><figcaption><span>ILLUSTRATIVE SAMPLE</span><span data-prism-caption>SEED 17</span></figcaption></figure>
      <dl class="prism-settings"><div><dt>Seed label</dt><dd data-prism-current>17</dd></div><div><dt>Gallery</dt><dd>3 saved samples</dd></div><div><dt>Prompt concept</dt><dd>A tiny world, ready to explore</dd></div></dl>
      <p class="demo-note">Illustrative portfolio samples, not actual Prism Studio model outputs. Seed numbers are demo labels, not recorded generation seeds. Selecting one loads saved artwork; it does not generate an image.</p>
      <p class="demo-status" role="status" data-prism-status>Illustrative seed 17 selected.</p>`;
    const img = root.querySelector("[data-prism-image]");
    const error = root.querySelector("[data-prism-error]");
    img.addEventListener("error", () => { img.hidden = true; error.hidden = false; });
    img.addEventListener("load", () => { img.hidden = false; error.hidden = true; });
    root.querySelectorAll("[data-prism-seed]").forEach((button) => button.addEventListener("click", () => {
      const seed = Number(button.dataset.prismSeed);
      root.querySelectorAll("[data-prism-seed]").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      img.hidden = false;
      error.hidden = true;
      img.alt = captions[seed];
      img.src = `/assets/prism/seed-${seed}.jpg`;
      root.querySelector("[data-prism-caption]").textContent = `SEED ${seed}`;
      root.querySelector("[data-prism-current]").textContent = seed;
      root.querySelector("[data-prism-status]").textContent = `Illustrative seed ${seed} selected.`;
    }));
  }
})(typeof window !== "undefined" ? window : globalThis);
