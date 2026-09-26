const year = document.querySelector("[data-current-year]");
const fxToggle = document.querySelector("[data-fx-toggle]");
const fxLabel = document.querySelector("[data-fx-label]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeLabel = document.querySelector("[data-theme-label]");
const themeColor = document.querySelector('meta[name="theme-color"]');
const shortcutLinks = [...document.querySelectorAll("[data-shortcut]")];

if (year) {
  year.textContent = new Date().getFullYear();
}

const themePreference = window.matchMedia("(prefers-color-scheme: dark)");
const validTheme = (value) => value === "light" || value === "dark";
let chosenTheme = null;

try {
  const savedTheme = localStorage.getItem("elliott-color-theme");
  if (validTheme(savedTheme)) chosenTheme = savedTheme;
} catch {
  // A system-based theme remains available when storage is blocked.
}

const setTheme = (theme) => {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = theme;
  themeToggle?.setAttribute("aria-pressed", String(dark));
  themeToggle?.setAttribute("aria-label", "START: Dark mode");
  themeColor?.setAttribute("content", dark ? "#17191f" : "#efede8");

  if (themeLabel) {
    themeLabel.textContent = dark ? "Dark mode: on" : "Dark mode: off";
  }
};

const followThemePreference = () => {
  setTheme(chosenTheme ?? (themePreference.matches ? "dark" : "light"));
};

followThemePreference();
themePreference.addEventListener("change", followThemePreference);

themeToggle?.addEventListener("click", () => {
  chosenTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(chosenTheme);

  try {
    localStorage.setItem("elliott-color-theme", chosenTheme);
  } catch {
    // Keep the manual choice for this page even if it cannot be saved.
  }
});

window.addEventListener("storage", (event) => {
  if (event.key !== "elliott-color-theme" && event.key !== null) return;
  try {
    if (event.storageArea && event.storageArea !== localStorage) return;
  } catch {
    return;
  }
  chosenTheme = validTheme(event.newValue) ? event.newValue : null;
  followThemePreference();
});

const setEffects = (enabled) => {
  document.body.classList.toggle("fx-off", !enabled);
  fxToggle?.setAttribute("aria-pressed", String(enabled));
  fxToggle?.setAttribute("aria-label", "Screen texture");

  if (fxLabel) {
    fxLabel.textContent = enabled ? "Texture: on" : "Texture: off";
  }

  try {
    localStorage.setItem("elliott-crt-effects", enabled ? "on" : "off");
  } catch {
    // The preference is optional; the toggle still works without local storage.
  }
};

if (fxToggle) {
  let effectsEnabled = false;

  try {
    effectsEnabled = localStorage.getItem("elliott-crt-effects") === "on";
  } catch {
    effectsEnabled = false;
  }

  setEffects(effectsEnabled);
  fxToggle.addEventListener("click", () => {
    setEffects(fxToggle.getAttribute("aria-pressed") !== "true");
  });
}

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTyping =
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

  if (document.querySelector("dialog[open]") || isTyping || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  const matchingLink = shortcutLinks.find((link) => link.dataset.shortcut === event.key);

  if (matchingLink) {
    event.preventDefault();
    document.querySelector(matchingLink.getAttribute("href"))?.scrollIntoView({
      behavior: (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced") ? "auto" : "smooth",
    });
  }
});
