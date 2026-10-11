/* Palette values: https://hancore.dev/wall.json. Picker implementation is original. */
(() => {
  "use strict";

  const palettes = [{"name":"banish","light":false,"accent":"#ff2fb3","bg":"#0c0b0d","fg":"#d8d1cc","selection":"#33ffe6","selectionText":"#0c0b0d","kinds":{"keyword":"#bd5cff","string":"#f2f2ea","number":"#8f57ff","function":"#6c70e0","type":"#53b1ca","comment":"#7d8581","text":"#d8d1cc"},"cursorline":"#1a191a"},{"name":"batou","light":false,"accent":"#605d5b","bg":"#121212","fg":"#dbd9d3","selection":"#eb7841","selectionText":"#121212","kinds":{"keyword":"#7286a8","string":"#6d837e","number":"#cc6528","function":"#77899a","type":"#c9c6ad","comment":"#626a78","text":"#dbd9d3","member":"#a4a4a4","punct":"#777673","ident":"#dbd9d3"},"cursorline":"#1a1a1e"},{"name":"blackgold","light":false,"accent":"#6e6a58","bg":"#0d0d0d","fg":"#ebdbb2","selection":"#241f16","kinds":{"keyword":"#8f6fd6","string":"#7c7c7c","number":"#d86a29","function":"#7f9080","type":"#bba84a","comment":"#8a8574","text":"#ebdbb2","member":"#108a8e","punct":"#7c7460","ident":"#ebdbb2"},"cursorline":"#1f1a12"},{"name":"blackmoney","light":false,"accent":"#d8d4b4","bg":"#0c0c0c","fg":"#d8d4b4","selection":"#525b54","kinds":{"keyword":"#689e80","string":"#2a593f","number":"#d8785b","function":"#d8d4b4","type":"#4e5f51","comment":"#a8a385","text":"#d8d4b4","member":"#88c6a3","punct":"#727060","ident":"#d8d4b4"},"cursorline":"#141414"},{"name":"blackturq","light":false,"accent":"#adf0e9","bg":"#0a0a0a","fg":"#c8dcdc","selection":"#182826","kinds":{"keyword":"#c58af5","string":"#8fecd5","number":"#ff8a4d","function":"#adf0e9","type":"#ffd84a","comment":"#6e8e8c","text":"#c8dcdc","member":"#63c9c4","punct":"#697373","ident":"#c8dcdc"},"cursorline":"#14201e"},{"name":"demon","light":false,"accent":"#5c624b","bg":"#121212","fg":"#eaeaea","selection":"#333333","selectionText":"#ffffff","kinds":{"keyword":"#059669","string":"#eaeaea","number":"#efbf04","function":"#dc2626","type":"#fbbf24","comment":"#8a8a8d","text":"#eaeaea","member":"#eaeaea","punct":"#8a8a8d","ident":"#d97706"},"cursorline":"#212121"},{"name":"dos-moos","light":false,"accent":"#819890","bg":"#131516","fg":"#f8ebe3","selection":"#59594b","kinds":{"keyword":"#8fb87a","string":"#b8ce76","number":"#e0c15c","function":"#a5b5ab","type":"#f4e276","comment":"#72856c","text":"#f8ebe3","member":"#6d877d","punct":"#86807d","ident":"#f8ebe3"},"cursorline":"#1f2629"},{"name":"greek-noir","light":false,"accent":"#f25623","bg":"#171717","fg":"#ccd0cf","selection":"#3a3a3a","kinds":{"keyword":"#f89a57","string":"#9cab76","number":"#f0913a","function":"#88a57d","type":"#aeab94","comment":"#878e87","text":"#ccd0cf","member":"#7b837b","punct":"#727473","ident":"#ccd0cf"},"cursorline":"#202020"},{"name":"harbor","light":true,"accent":"#5e81ac","bg":"#dfe4c4","fg":"#1c2d28","selection":"#c8d4a8","kinds":{"keyword":"#386593","string":"#4a6a4a","number":"#9d4b25","function":"#386593","type":"#8f5424","comment":"#606c68","text":"#1c2d28","member":"#256b7a","punct":"#7e8976","ident":"#1c2d28"},"cursorline":"#ecebbd"},{"name":"harbordark","light":false,"accent":"#e75a50","bg":"#1b1b1b","fg":"#efebdc","selection":"#323232","kinds":{"keyword":"#9683a1","string":"#a99b7a","number":"#e67e22","function":"#9ba2a6","type":"#e1ce98","comment":"#817f68","text":"#efebdc","member":"#77868a","punct":"#85837c","ident":"#efebdc"},"cursorline":"#323232"},{"name":"inkypinky","light":false,"accent":"#7c7ca8","bg":"#1a1826","fg":"#e0dce8","selection":"#3d3856","selectionText":"#e0dce8","kinds":{"keyword":"#b0a8c0","string":"#e8b0c4","number":"#f0a8b0","function":"#c4d0ee","type":"#98c8c8","comment":"#a8d4b0","text":"#e0dce8","member":"#e0dce8","punct":"#e0dce8","ident":"#e0dce8"},"cursorline":"#2c2e33"},{"name":"kanso","light":false,"accent":"#8ba4b0","bg":"#090e13","fg":"#c5c9c7","selection":"#393b44","kinds":{"keyword":"#8992a7","string":"#8a9a7b","number":"#a292a3","function":"#8ba4b0","type":"#8ea4a2","comment":"#75797f","text":"#c5c9c7","member":"#8992a7","punct":"#909398","ident":"#c5c9c7"},"cursorline":"#22262d"},{"name":"labra","light":false,"accent":"#e33d84","bg":"#040704","fg":"#d3d7b5","selection":"#1d201d","selectionText":"#dee1c8","kinds":{"keyword":"#d54a8e","string":"#747f11","number":"#d3dd2c","function":"#e33d84","type":"#7d7a56","comment":"#585d58","text":"#d3d7b5"},"cursorline":"#121610"},{"name":"lasthorizon","light":false,"accent":"#b59790","bg":"#0c0b0c","fg":"#f1f1ef","selection":"#e8e3e2","selectionText":"#141112","kinds":{"keyword":"#b19be2","string":"#468a9b","number":"#ea8160","function":"#929fc8","type":"#b4a4c4","comment":"#949fa6","text":"#f1f1ef","member":"#b59790","punct":"#7f7e7e","ident":"#f1f1ef"},"cursorline":"#241f22"},{"name":"mechanoonna","light":false,"accent":"#d4bd99","bg":"#1c1b19","fg":"#d4be98","selection":"#3c3836","kinds":{"keyword":"#ea6962","string":"#89b482","number":"#d3869b","function":"#a9b665","type":"#d8a657","comment":"#928374","text":"#d4be98","member":"#7daea3","punct":"#928374","ident":"#d4be98"},"cursorline":"#282828"},{"name":"moodpeak","light":false,"accent":"#4ecdc4","bg":"#181c22","fg":"#e0e6ed","selection":"#2c3444","kinds":{"keyword":"#b388eb","string":"#4ecdc4","number":"#ffb38a","function":"#6a85ff","type":"#e8ffad","comment":"#8791a6","text":"#e0e6ed","member":"#82eeff","punct":"#7c8188","ident":"#e0e6ed"},"cursorline":"#282c32"},{"name":"oxford","light":false,"accent":"#bda07f","bg":"#292b31","fg":"#d4be98","selection":"#504945","kinds":{"keyword":"#ea6962","string":"#89b482","number":"#d3869b","function":"#a9b665","type":"#d8a657","comment":"#928374","text":"#d4be98","member":"#7daea3","punct":"#928374","ident":"#d4be98"},"cursorline":"#3c3836"},{"name":"oxocarbon","light":false,"accent":"#33b1ff","bg":"#161616","fg":"#d0d0d0","selection":"#393939","kinds":{"keyword":"#78a9ff","string":"#be95ff","number":"#82cfff","function":"#ff7eb6","type":"#78a9ff","comment":"#525252","text":"#d0d0d0","member":"#d0d0d0","punct":"#3ddbd9","ident":"#d0d0d0"},"cursorline":"#262626"},{"name":"roseofdune","light":true,"accent":"#76634c","bg":"#f5e6d3","fg":"#35302a","selection":"#ddc3c9","kinds":{"keyword":"#713a56","string":"#76661d","number":"#9b5625","function":"#9e4f5b","type":"#713a56","comment":"#8c7458","text":"#35302a","member":"#76634c","punct":"#958b7f","ident":"#35302a"},"cursorline":"#ecdcc6"},{"name":"ryu","light":false,"accent":"#525e5a","bg":"#050505","fg":"#d6d0c5","selection":"#1e1e1e","kinds":{"keyword":"#c2a46d","string":"#8b9388","number":"#e07969","function":"#75897f","type":"#51605b","comment":"#404040","text":"#d6d0c5","member":"#717c7c","punct":"#6e6b65","ident":"#d6d0c5"},"cursorline":"#141414"},{"name":"saga","light":false,"accent":"#b2fff3","bg":"#05080a","fg":"#f3ceff","selection":"#ffc2df","selectionText":"#05080a","kinds":{"keyword":"#dfbaff","string":"#baf7b5","number":"#ffc79b","function":"#9ab4f9","type":"#fff6c3","comment":"#9094a2","text":"#f3ceff","member":"#b2fff3","punct":"#7c6b85","ident":"#f3ceff"},"cursorline":"#28213a"},{"name":"sapphire","light":false,"accent":"#f7c3c6","bg":"#060d1f","fg":"#e0f7fa","selection":"#d7ebe9","selectionText":"#374cb3","kinds":{"keyword":"#85cec4","string":"#6488ea","number":"#d5edeb","function":"#f7c3c6","type":"#fff6d2","comment":"#51688e","text":"#e0f7fa"},"cursorline":"#151d2e"},{"name":"shadesofjade","light":false,"accent":"#d1ffb0","bg":"#00110b","fg":"#e6f6f0","selection":"#1f302a","kinds":{"keyword":"#e25f4b","string":"#00a86b","number":"#ff6600","function":"#8fc85c","type":"#d1ffb0","comment":"#5e8a72","text":"#e6f6f0","member":"#80d4b5","punct":"#73847e","ident":"#e6f6f0"},"cursorline":"#0c1d17"},{"name":"solitude","light":false,"accent":"#798186","bg":"#101315","fg":"#cacccc","selection":"#798186","selectionText":"#101315","kinds":{"keyword":"#aeaeae","string":"#9fa5a9","number":"#d9dbdc","function":"#798186","type":"#707070","comment":"#4b4e55","text":"#cacccc"},"cursorline":"#1d2022"},{"name":"thegreek","light":true,"accent":"#de6a41","bg":"#d0d0c8","fg":"#242424","selection":"#c3c1cf","kinds":{"keyword":"#624d85","string":"#3d6035","number":"#953b19","function":"#754e3e","type":"#794e17","comment":"#59574d","text":"#242424","member":"#814363","punct":"#7a7a76","ident":"#242424"},"cursorline":"#dcdcd4"},{"name":"turbonite","light":false,"accent":"#ed9a1d","bg":"#0b0c0c","fg":"#eae9e3","selection":"#45413a","kinds":{"keyword":"#9a7a3c","string":"#a7a483","number":"#c84f8a","function":"#847b4e","type":"#ebd698","comment":"#7f7b71","text":"#eae9e3","member":"#ed9a1d","punct":"#7b7b78","ident":"#eae9e3"},"cursorline":"#17181a"},{"name":"velvetnight","light":false,"accent":"#9099a5","bg":"#0a101f","fg":"#ffffff","selection":"#28302b","kinds":{"keyword":"#f9cbf6","string":"#5c637a","number":"#e2687c","function":"#c24f40","type":"#e5af1b","comment":"#9099a5","text":"#ffffff","member":"#f5ecdf","punct":"#85888f","ident":"#ffffff"},"cursorline":"#151b2a"},{"name":"whitegold","light":true,"accent":"#005c32","bg":"#dedbc8","fg":"#0c0c14","selection":"#c4c1ac","kinds":{"keyword":"#2e311a","string":"#005c32","number":"#6c5319","function":"#2e311a","type":"#725c0a","comment":"#5a5340","text":"#0c0c14","member":"#3b3b3b","punct":"#75746e","ident":"#0c0c14"},"cursorline":"#e9e6d3"}];
  const byName = new Map(palettes.map((palette) => [palette.name, palette]));
  const root = document.documentElement;
  const preferenceKey = "elliott:theme";
  const aliases = { carbon: "blackmoney", parchment: "whitegold", phosphor: "shadesofjade" };
  const rowCount = 8;
  let current = "blackmoney";
  let original = current;
  let opener;
  let options = palettes;
  let selected = 0;

  function store(name) {
    try { window.localStorage.setItem(preferenceKey, name); } catch { /* Works for this visit when storage is denied. */ }
  }

  function mix(foreground, background, amount) {
    const channel = (hex, at) => parseInt(hex.slice(at, at + 2), 16);
    return `#${[1, 3, 5].map((at) => Math.round(channel(foreground, at) * amount + channel(background, at) * (1 - amount)).toString(16).padStart(2, "0")).join("")}`;
  }

  function apply(name, { persist = true } = {}) {
    const palette = byName.get(name);
    if (!palette) return false;
    current = name;
    root.dataset.theme = name;
    root.style.colorScheme = palette.light ? "light" : "dark";
    const variables = {
      paper: palette.bg, bg: palette.bg, ink: palette.fg,
      muted: mix(palette.fg, palette.bg, .68), faint: mix(palette.fg, palette.bg, .4),
      line: mix(palette.fg, palette.bg, .23), accent: palette.accent,
      panel: palette.cursorline, highlight: palette.kinds.keyword,
      selection: palette.selection, "selection-ink": palette.selectionText || palette.fg,
      chrome: mix(palette.fg, palette.bg, .72),
    };
    Object.entries(palette.kinds).forEach(([kind, color]) => { variables[`syntax-${kind}`] = color; });
    // A few source palettes do not define every token family.
    for (const kind of ["keyword", "string", "number", "function", "type", "comment", "member", "punct", "ident", "text"]) {
      variables[`syntax-${kind}`] = palette.kinds[kind] || palette.fg;
    }
    Object.entries(variables).forEach(([key, value]) => root.style.setProperty(`--${key}`, value));
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", palette.bg);
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", `Choose colorscheme; current theme: ${name}`);
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-controls", "theme-dialog");
      button.removeAttribute("title");
    });
    document.querySelectorAll("[data-theme-label]").forEach((label) => { label.textContent = name; });
    if (persist) store(name);
    window.dispatchEvent(new CustomEvent("portfolio:preferences", {
      detail: { theme: name, palette, motion: root.dataset.motion || "running", preview: !persist },
    }));
    return true;
  }

  function element(tag, attributes = {}, text = "") {
    const node = document.createElement(tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    if (text) node.textContent = text;
    return node;
  }

  const dialog = element("dialog", { id: "theme-dialog", class: "theme-picker", "aria-labelledby": "theme-picker-title", "aria-describedby": "theme-picker-help" });
  const title = element("h2", { id: "theme-picker-title", class: "theme-picker-title" }, "colorscheme");
  const searchRow = element("div", { class: "theme-picker-search" });
  const prompt = element("span", { "aria-hidden": "true" }, ":");
  const input = element("input", {
    id: "theme-picker-search", type: "text", role: "combobox", "aria-label": "Find colorscheme",
    "aria-autocomplete": "list", "aria-controls": "theme-picker-options", "aria-expanded": "true",
    autocomplete: "off", autocapitalize: "off", spellcheck: "false",
  });
  const list = element("div", { id: "theme-picker-options", class: "theme-picker-options", role: "listbox", "aria-label": "Colorschemes" });
  const counter = element("span", { class: "theme-picker-counter", "aria-hidden": "true" });
  const instructions = element("p", { id: "theme-picker-help", class: "theme-picker-sr" }, "Type to filter. Arrow keys preview a theme. Enter or click to keep it. Escape restores your previous theme.");
  const announcement = element("span", { class: "theme-picker-sr", role: "status", "aria-live": "polite" });
  searchRow.append(prompt, input);
  dialog.append(title, searchRow, list, counter, instructions, announcement);
  document.body.append(dialog);

  function draw() {
    const start = Math.max(0, Math.min(selected - Math.floor(rowCount / 2), options.length - rowCount));
    list.replaceChildren();
    if (!options.length) {
      list.append(element("span", { class: "theme-picker-empty" }, "no match"));
      input.removeAttribute("aria-activedescendant");
    }
    options.slice(start, start + rowCount).forEach((palette, offset) => {
      const index = start + offset;
      const chosen = selected === index;
      const option = element("div", {
        id: `theme-option-${palette.name}`, class: "theme-picker-option", role: "option",
        "aria-selected": String(chosen), "aria-posinset": String(index + 1), "aria-setsize": String(options.length),
        "data-theme-option": palette.name,
      });
      const arrow = element("span", { class: "theme-picker-arrow", "aria-hidden": "true" }, chosen ? "›" : " ");
      const name = element("span", { class: "theme-picker-name" }, palette.name);
      const swatches = element("span", { class: "theme-picker-swatches", "aria-hidden": "true" });
      for (const kind of ["keyword", "string", "number", "function", "type", "comment", "member", "punct"]) {
        const swatch = element("span");
        swatch.style.backgroundColor = palette.kinds[kind] || palette.fg;
        swatches.append(swatch);
      }
      option.append(arrow, name, swatches);
      if (palette.light) option.append(element("span", { class: "theme-picker-light" }, "light"));
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.addEventListener("click", () => {
        selected = index;
        apply(palette.name, { persist: false });
        close(true);
      });
      list.append(option);
      if (chosen) input.setAttribute("aria-activedescendant", option.id);
    });
    counter.textContent = `${options.length ? selected + 1 : 0}/${options.length}`;
    announcement.textContent = options.length ? `${options[selected].name}, ${selected + 1} of ${options.length}` : "No matching colorschemes";
  }

  function preview() {
    if (options[selected]) apply(options[selected].name, { persist: false });
    draw();
  }

  function open() {
    if (dialog.open) return;
    original = current;
    opener = document.activeElement;
    input.value = "";
    options = palettes;
    selected = Math.max(0, palettes.findIndex((palette) => palette.name === current));
    draw();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    root.dataset.themePicker = "open";
    window.dispatchEvent(new CustomEvent("portfolio:theme-picker", { detail: { open: true } }));
    input.focus({ preventScroll: true });
  }

  function close(keep = true) {
    if (!dialog.open) return;
    if (keep) apply(current);
    else apply(original, { persist: false });
    root.dataset.themePicker = "closed";
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    window.dispatchEvent(new CustomEvent("portfolio:theme-picker", { detail: { open: false } }));
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }

  input.addEventListener("input", () => {
    const search = input.value.trim().toLowerCase();
    options = palettes.filter((palette) => palette.name.includes(search));
    selected = 0;
    preview();
  });
  dialog.addEventListener("keydown", (event) => {
    // Keep the portfolio's global shortcuts out of this native text field.
    event.stopPropagation();
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close(false);
    } else if (event.key === "Enter") {
      event.preventDefault();
      close(true);
    } else if (["ArrowDown", "ArrowUp", "Tab"].includes(event.key)) {
      event.preventDefault();
      if (!options.length) return;
      const direction = event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey) ? -1 : 1;
      selected = (selected + direction + options.length) % options.length;
      preview();
    }
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close(false);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close(true);
  });
  list.addEventListener("wheel", (event) => {
    if (!options.length || !event.deltaY) return;
    event.preventDefault();
    selected = Math.max(0, Math.min(options.length - 1, selected + Math.sign(event.deltaY)));
    preview();
  }, { passive: false });
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => button.addEventListener("click", open));

  window.PortfolioThemes = Object.freeze({
    names: Object.freeze(palettes.map((palette) => palette.name)), apply, open, close,
    get current() { return current; },
    get palette() { return byName.get(current); },
  });
  let saved;
  try { saved = window.localStorage.getItem(preferenceKey); } catch { /* Use the default. */ }
  const initial = byName.has(saved) ? saved : Object.hasOwn(aliases, saved) ? aliases[saved] : "blackmoney";
  apply(initial, { persist: false });
})();
