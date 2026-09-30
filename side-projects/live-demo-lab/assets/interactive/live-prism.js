(function (global) {
  "use strict";

  const MODEL = "stability.stable-image-core-v1:1";
  const MAX_SEED = 4294967295;
  const RETENTION_MS = 24 * 60 * 60 * 1000;
  const POLL_WINDOW_MS = 10 * 60 * 1000;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const memory = { record: null, draft: null };
  const ERRORS = {
    GENERATION_DISABLED: "Live generation is switched off. Your prompt has not been generated.",
    GENERATION_LIMIT_REACHED: "The shared generation allowance has been reached. Try again another day; the monthly allowance may also be full.",
    CONTENT_FILTERED: "The image service filtered this request. Change the prompt before trying again.",
    GENERATION_FAILED: "The image service could not finish this attempt. A failed attempt can still use an allowance.",
    GENERATION_TIMED_OUT: "This attempt timed out. Check its result before starting another attempt.",
    INVALID_MODEL_RESPONSE: "The image service returned an unreadable result. This attempt may have used an allowance.",
    GENERATION_NOT_FOUND: "No saved result was found. Results are available for up to 24 hours.",
    REQUEST_EXPIRED: "This request has expired. Start a new attempt if you want another image.",
    REQUEST_ID_CONFLICT: "This request could not be matched safely. Reopen the demo before trying again.",
    ORIGIN_NOT_ALLOWED: "This preview is not allowed by the image service configuration.",
    SERVICE_UNAVAILABLE: "The image service is unavailable. You can check again without starting a new generation.",
    INVALID_RESPONSE: "The image service returned an unexpected response. Check the request before trying again.",
    NETWORK_ERROR: "The connection was interrupted. The request may still be running; check its result or retry the same request safely.",
    INVALID_PROMPT: "Write a prompt between 3 and 1,000 characters.",
    INVALID_SEED: "Enter a whole seed number from 1 to 4,294,967,295.",
  };

  class DemoError extends Error {
    constructor(code, status = 0) { super(ERRORS[code] || ERRORS.SERVICE_UNAVAILABLE); this.code = code; this.status = status; }
  }

  function endpoint(value) {
    if (!value || !value.trim()) return null;
    let parsed;
    try { parsed = new URL(value.trim()); } catch { throw new DemoError("INVALID_RESPONSE"); }
    if (parsed.protocol !== "https:" || !/^[a-z0-9]+\.execute-api\.us-west-2\.amazonaws\.com$/.test(parsed.hostname)
      || parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new DemoError("INVALID_RESPONSE");
    }
    return parsed.origin;
  }

  function inputs(prompt, seed) {
    if (typeof prompt !== "string") throw new DemoError("INVALID_PROMPT");
    prompt = prompt.trim();
    if (Array.from(prompt).length < 3 || Array.from(prompt).length > 1000
      || /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]|\p{Surrogate}/u.test(prompt)) {
      throw new DemoError("INVALID_PROMPT");
    }
    if (typeof seed === "string" && !/^[0-9]{1,10}$/.test(seed)) throw new DemoError("INVALID_SEED");
    if (typeof seed !== "string" && typeof seed !== "number") throw new DemoError("INVALID_SEED");
    seed = Number(seed);
    if (!Number.isInteger(seed) || seed < 1 || seed > MAX_SEED) throw new DemoError("INVALID_SEED");
    return { prompt, seed };
  }

  function randomSeed(crypto) {
    if (!crypto || typeof crypto.getRandomValues !== "function") throw new DemoError("SERVICE_UNAVAILABLE");
    const bytes = new Uint32Array(1);
    // Rejection preserves a uniform distribution over all nonzero uint32 seeds.
    do { crypto.getRandomValues(bytes); } while (bytes[0] === 0);
    return bytes[0];
  }

  function requestId(crypto) {
    if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    if (!crypto || typeof crypto.getRandomValues !== "function") throw new DemoError("SERVICE_UNAVAILABLE");
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function signedImageURL(value, jobId) {
    let parsed;
    try { parsed = new URL(value); } catch { throw new DemoError("INVALID_RESPONSE"); }
    const host = /^(?:[a-z0-9][a-z0-9.-]*\.)?s3(?:[.-]us-west-2)?\.amazonaws\.com$/;
    const path = parsed.pathname;
    const validPath = path === `/generated/${jobId}.png`
      || (/^s3(?:[.-]us-west-2)?\.amazonaws\.com$/.test(parsed.hostname)
        && new RegExp(`^/[a-z0-9][a-z0-9.-]*/generated/${jobId}\\.png$`).test(path));
    const expires = parsed.searchParams.get("X-Amz-Expires");
    if (parsed.protocol !== "https:" || !host.test(parsed.hostname) || parsed.username || parsed.password
      || parsed.port || parsed.hash || !validPath || !/^[0-9]{1,3}$/.test(expires || "")
      || Number(expires) < 1 || Number(expires) > 300
      || parsed.searchParams.get("X-Amz-Algorithm") !== "AWS4-HMAC-SHA256"
      || !/^[a-f0-9]{64}$/i.test(parsed.searchParams.get("X-Amz-Signature") || "")) {
      throw new DemoError("INVALID_RESPONSE");
    }
    return parsed.href;
  }

  function healthResponse(value) {
    if (!value || typeof value.enabled !== "boolean" || value.model !== MODEL || !value.limits
      || !["monthly", "daily", "perIpDaily"].every((key) => Number.isInteger(value.limits[key]) && value.limits[key] > 0)) {
      throw new DemoError("INVALID_RESPONSE");
    }
    return { enabled: value.enabled, model: MODEL, limits: {
      monthly: value.limits.monthly, daily: value.limits.daily, perIpDaily: value.limits.perIpDaily,
    } };
  }

  function submissionResponse(value, record) {
    if (!value || value.jobId !== record.requestId || !UUID.test(value.jobId)
      || !["queued", "running", "succeeded", "failed"].includes(value.status)) throw new DemoError("INVALID_RESPONSE");
    return value;
  }

  function resultResponse(value, record) {
    submissionResponse(value, record);
    if (value.prompt !== record.prompt || value.seed !== record.seed || value.model !== MODEL || !value.settings
      || value.settings.aspectRatio !== "1:1" || value.settings.outputFormat !== "png" || value.settings.images !== 1) {
      throw new DemoError("INVALID_RESPONSE");
    }
    const result = { jobId: value.jobId, status: value.status, prompt: value.prompt, seed: value.seed, model: MODEL,
      settings: { aspectRatio: "1:1", outputFormat: "png", images: 1 } };
    if (value.status === "succeeded") {
      const { width, height } = value.settings;
      if (!Number.isInteger(width) || width !== height || width < 640 || width > 1536) throw new DemoError("INVALID_RESPONSE");
      result.settings.width = width; result.settings.height = height;
      result.imageUrl = signedImageURL(value.imageUrl, record.requestId);
    }
    if (value.status === "failed") {
      const code = value.error && value.error.code;
      result.error = { code: Object.hasOwn(ERRORS, code) ? code : "GENERATION_FAILED" };
    }
    return result;
  }

  function reusableRecord(record, api, value, now) {
    return record && record.api === api && record.prompt === value.prompt && record.seed === value.seed
      && now - record.startedAt < RETENTION_MS && !["failed", "expired"].includes(record.status) ? record : null;
  }

  class Client {
    constructor({ api, fetch: fetcher, crypto, onChange = () => {}, store = memory, now = Date.now,
      setTimeout: schedule = global.setTimeout.bind(global), clearTimeout: clear = global.clearTimeout.bind(global) }) {
      this.api = endpoint(api); this.fetch = fetcher; this.crypto = crypto; this.onChange = onChange;
      this.store = store; this.now = now; this.schedule = schedule; this.clear = clear;
      this.active = true; this.busy = false; this.timer = null; this.requestTimer = null; this.controller = null;
      this.health = null; this.phase = this.api ? "checking" : "disconnected";
      this.message = this.api ? "Checking the image service…" : "Local prototype · AWS generation is not connected.";
      if (store.record && (store.record.api !== this.api || now() - store.record.startedAt >= RETENTION_MS)) store.record = null;
    }

    emit() {
      if (this.active) this.onChange({ phase: this.phase, message: this.message, busy: this.busy,
        health: this.health, record: this.store.record, connected: Boolean(this.api) });
    }

    async call(path, options = {}) {
      const controller = new AbortController();
      this.controller = controller;
      this.requestTimer = this.schedule(() => controller.abort(), 15000);
      try {
        const response = await this.fetch(this.api + path, { ...options, signal: controller.signal,
          credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer" });
        if (!this.active) return null;
        if (controller.signal.aborted) throw new DemoError("NETWORK_ERROR");
        let value;
        try { value = await response.json(); } catch { throw new DemoError("INVALID_RESPONSE"); }
        if (!this.active) return null;
        if (controller.signal.aborted) throw new DemoError("NETWORK_ERROR");
        if (!response.ok) {
          const code = value && value.error && value.error.code;
          throw new DemoError(Object.hasOwn(ERRORS, code) ? code : "SERVICE_UNAVAILABLE", response.status);
        }
        if ((options.method === "POST" && response.status !== 202) || (!options.method && response.status !== 200)) {
          throw new DemoError("INVALID_RESPONSE");
        }
        return value;
      } catch (error) {
        if (!this.active) return null;
        throw error instanceof DemoError ? error : new DemoError("NETWORK_ERROR");
      } finally {
        this.clear(this.requestTimer); this.requestTimer = null;
        if (this.controller === controller) this.controller = null;
      }
    }

    async mount() {
      if (this.busy || !this.active) return;
      this.emit();
      if (!this.api || !this.active) return;
      this.busy = true; this.emit();
      try {
        const result = await this.call("/health");
        if (!this.active) return;
        this.health = healthResponse(result);
        this.phase = this.health.enabled ? "ready" : "disabled";
        this.message = this.health.enabled ? "Ready. Choose a prompt and seed, then generate one image." : ERRORS.GENERATION_DISABLED;
      } catch (error) {
        if (!this.active) return;
        this.phase = "offline"; this.message = error.message;
      } finally { this.busy = false; this.emit(); }
      if (this.active && this.store.record) await this.check();
    }

    async generate(prompt, seed) {
      if (!this.active || this.busy || !this.health || !this.health.enabled) return;
      let value;
      try { value = inputs(prompt, seed); } catch (error) { this.message = error.message; this.emit(); return; }
      const retained = this.store.record;
      if (retained && ["uncertain", "queued", "running"].includes(retained.status)
        && (retained.prompt !== value.prompt || retained.seed !== value.seed)) {
        this.message = "Check the pending request before starting a different image."; this.emit(); return;
      }
      let record = reusableRecord(retained, this.api, value, this.now());
      if (record && (record.jobId || record.status === "succeeded")) { await this.check(); return; }
      if (!record) {
        record = { ...value, api: this.api, requestId: requestId(this.crypto), jobId: null,
          startedAt: this.now(), status: "uncertain", result: null };
        this.store.record = record;
      }
      this.clear(this.timer); this.timer = null;
      this.busy = true; this.phase = "submitting"; this.message = "Sending one image request…"; this.emit();
      record.status = "uncertain";
      try {
        const result = await this.call("/generations", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: record.prompt, seed: record.seed, requestId: record.requestId }) });
        if (!this.active) return;
        submissionResponse(result, record);
        record.jobId = result.jobId; record.status = result.status;
      } catch (error) {
        if (!this.active) return;
        if ([400, 403, 409, 413, 415, 429].includes(error.status) || error.code === "GENERATION_DISABLED") record.status = "rejected";
        this.phase = "paused"; this.message = error.message;
      } finally { this.busy = false; this.emit(); }
      if (this.active && record.jobId) await this.check();
    }

    async check() {
      const record = this.store.record;
      if (!this.active || this.busy || !this.api || !record) return;
      this.clear(this.timer); this.timer = null;
      this.busy = true; this.phase = "checking-result"; this.message = "Checking this request; no new image is being generated…"; this.emit();
      try {
        const value = await this.call(`/generations/${record.requestId}`);
        if (!this.active) return;
        const result = resultResponse(value, record);
        record.jobId = result.jobId; record.status = result.status; record.result = result;
        this.phase = result.status;
        if (result.status === "succeeded") this.message = "Your image is ready. Save the image and its settings before access expires.";
        else if (result.status === "failed") this.message = ERRORS[result.error.code];
        else this.message = result.status === "queued" ? "Your image is queued. This panel will check its progress automatically." : "Your image is generating. This panel will check its progress automatically.";
      } catch (error) {
        if (!this.active) return;
        this.phase = "paused"; this.message = error.message;
        if (error.code === "GENERATION_NOT_FOUND") {
          if (record.jobId) { record.status = "expired"; record.result = null; }
          else { record.status = "rejected"; this.message = "No saved request was found. Retry safely to submit the same request ID."; }
        }
      } finally { this.busy = false; this.emit(); }
      if (this.active && ["queued", "running"].includes(record.status) && this.phase !== "paused") {
        if (this.now() - record.startedAt >= POLL_WINDOW_MS) {
          this.phase = "paused"; this.message = "Automatic checks paused after 10 minutes. Check the same result manually; this will not generate another image."; this.emit();
        } else this.timer = this.schedule(() => { this.timer = null; void this.check(); }, 4000);
      }
    }

    dispose() {
      this.active = false; this.clear(this.timer); this.clear(this.requestTimer);
      this.timer = null; this.requestTimer = null;
      if (this.controller) this.controller.abort();
    }
  }

  function render(root) {
    const document = root.ownerDocument;
    let api;
    try { api = endpoint(document.querySelector('meta[name="portfolio-demo-api"]')?.content || ""); }
    catch { api = null; }
    let initialSeed = 42;
    try { initialSeed = randomSeed(global.crypto); } catch { /* The form stays usable with an explicit seed. */ }
    const draft = memory.draft || memory.record || { prompt: "A tiny coastal observatory beneath a starry sky, illustrated in amber, sage and midnight blue", seed: initialSeed };
    root.innerHTML = `
      <div class="demo-heading"><p class="playground-eyebrow">LIVE IMAGE LAB</p><h3>Make a world of your own.</h3><p>Write a prompt, choose a seed, and keep the settings alongside your image.</p></div>
      <form class="demo-editor" data-live-form>
        <label class="demo-field" for="prism-live-prompt">Your prompt<textarea id="prism-live-prompt" rows="4" maxlength="1000" required minlength="3" aria-describedby="prism-live-privacy"></textarea></label>
        <label class="demo-field" for="prism-live-seed">Seed<input id="prism-live-seed" type="text" inputmode="numeric" pattern="[0-9]{1,10}" maxlength="10" required autocomplete="off" aria-describedby="prism-live-seed-help"><span class="demo-note" id="prism-live-seed-help">A whole number from 1 to 4,294,967,295. The same seed and settings help revisit a result; future model changes can affect it.</span></label>
        <div class="demo-actions"><button class="demo-button" type="button" data-live-random>Random seed</button><button class="demo-button demo-button-primary" type="submit" data-live-generate disabled>Generate one image</button><button class="demo-button" type="button" data-live-check hidden>Check result</button><button class="demo-button" type="button" data-live-connect hidden>Check connection</button></div>
      </form>
      <p class="demo-status" role="status" aria-live="polite" aria-atomic="true" data-live-status></p>
      <p class="demo-note" data-live-limits></p>
      <p class="demo-note" id="prism-live-privacy">When connected, Generate sends your prompt and seed to AWS Bedrock. Avoid private information. One square PNG per attempt. This browser keeps only the most recent request in memory; reloading the page clears it.</p>
      <section data-live-result hidden aria-label="Generated image and settings">
        <figure class="prism-art"><img data-live-image alt="" decoding="async" referrerpolicy="no-referrer"><figcaption><span>GENERATED WITH AWS BEDROCK</span><span data-live-image-caption></span></figcaption></figure>
        <p class="demo-note" data-live-image-error hidden>The image link may have expired. Check the result to refresh its link.</p>
        <dl class="prism-settings" data-live-settings></dl>
        <div class="demo-actions"><a class="demo-button" data-live-save target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Open / save image</a><button class="demo-button" type="button" data-live-download>Download settings</button></div>
        <p class="demo-note">Result access lasts up to 24 hours. Image links expire within 5 minutes; Check result refreshes the link while the result is available. Keep your downloaded image and settings if you want to save this experiment.</p>
      </section>
      <p class="demo-note" data-live-empty>No generated image yet. This local prototype makes no image request until an AWS endpoint is connected and you choose Generate.</p>`;
    const query = (selector) => root.querySelector(selector);
    const form = query("[data-live-form]"), prompt = query("#prism-live-prompt"), seed = query("#prism-live-seed");
    const generate = query("[data-live-generate]"), random = query("[data-live-random]"), check = query("[data-live-check]");
    const connect = query("[data-live-connect]"), status = query("[data-live-status]");
    const resultPanel = query("[data-live-result]"), image = query("[data-live-image]"), download = query("[data-live-download]");
    prompt.value = draft.prompt; seed.value = String(draft.seed);
    let lastImage = "", disposed = false;
    const objectUrls = new Set();
    const listeners = [];
    const listen = (target, event, handler) => { target.addEventListener(event, handler); listeners.push(() => target.removeEventListener(event, handler)); };
    const paint = (state) => {
      status.textContent = state.message;
      const pending = state.record && ["uncertain", "queued", "running"].includes(state.record.status);
      const waitingKnown = pending && state.record.jobId;
      generate.disabled = state.busy || !state.health?.enabled || Boolean(waitingKnown);
      generate.textContent = pending && !waitingKnown ? "Retry same request safely" : "Generate one image";
      prompt.disabled = seed.disabled = random.disabled = state.busy || Boolean(pending);
      form.setAttribute("aria-busy", String(state.busy));
      check.hidden = !state.record; check.disabled = state.busy;
      connect.hidden = !state.connected || state.health !== null; connect.disabled = state.busy;
      query("[data-live-limits]").textContent = state.health ? `Shared allowance: ${state.health.limits.daily} attempts per UTC day, ${state.health.limits.monthly} per UTC month, and ${state.health.limits.perIpDaily} per network address per day. Failed or filtered attempts can use this allowance.` : "";
      const result = state.record?.result;
      const succeeded = result?.status === "succeeded";
      resultPanel.hidden = !succeeded;
      query("[data-live-empty]").hidden = Boolean(succeeded);
      if (succeeded) {
        if (result.imageUrl !== lastImage) {
          lastImage = result.imageUrl; image.src = lastImage; image.alt = `Generated image: ${result.prompt}`;
          image.hidden = false; query("[data-live-image-error]").hidden = true;
        }
        query("[data-live-image-caption]").textContent = `SEED ${result.seed}`;
        query("[data-live-save]").href = result.imageUrl;
        const settings = query("[data-live-settings]"); settings.replaceChildren();
        const fields = [["Prompt", result.prompt], ["Seed", String(result.seed)], ["Model", result.model],
          ["Output", `${result.settings.width} × ${result.settings.height} PNG · ${result.settings.aspectRatio}`]];
        for (const [label, value] of fields) {
          const row = document.createElement("div"), term = document.createElement("dt"), detail = document.createElement("dd");
          term.textContent = label; detail.textContent = value; detail.style.overflowWrap = "anywhere";
          row.append(term, detail); settings.append(row);
        }
      }
    };
    const client = new Client({ api: api || "", fetch: global.fetch.bind(global), crypto: global.crypto, onChange: paint });
    const saveDraft = () => { memory.draft = { prompt: prompt.value, seed: seed.value }; };
    listen(prompt, "input", saveDraft); listen(seed, "input", saveDraft);
    listen(form, "submit", (event) => { event.preventDefault(); saveDraft(); void client.generate(prompt.value, seed.value); });
    listen(random, "click", () => { try { seed.value = String(randomSeed(global.crypto)); saveDraft(); } catch { status.textContent = "Random seed is unavailable. Enter a seed number above."; } });
    listen(check, "click", () => { void client.check(); });
    listen(connect, "click", () => { void client.mount(); });
    listen(image, "error", () => { if (!disposed) { image.hidden = true; query("[data-live-image-error]").hidden = false; } });
    listen(download, "click", () => {
      const result = memory.record?.result;
      if (!result || result.status !== "succeeded") return;
      const data = { prompt: result.prompt, seed: result.seed, model: result.model, settings: result.settings,
        jobId: result.jobId, note: "Same seed and settings help replay a result; future model changes can affect it." };
      const url = global.URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" }));
      objectUrls.add(url);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `prism-seed-${result.seed}.json`;
      root.append(anchor); anchor.click(); anchor.remove();
    });
    void client.mount();
    return () => {
      saveDraft(); disposed = true; client.dispose(); listeners.forEach((remove) => remove());
      objectUrls.forEach((url) => global.URL.revokeObjectURL(url)); objectUrls.clear();
      image.removeAttribute("src");
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = {
    Client, DemoError, endpoint, inputs, randomSeed, requestId, signedImageURL, healthResponse,
    submissionResponse, resultResponse, reusableRecord, MODEL, MAX_SEED, RETENTION_MS, POLL_WINDOW_MS,
  };
  global.PortfolioLivePrism = render;
})(typeof window !== "undefined" ? window : globalThis);
