const year = document.querySelector("[data-current-year]");
const fxToggle = document.querySelector("[data-fx-toggle]");
const fxLabel = document.querySelector("[data-fx-label]");
const shortcutLinks = [...document.querySelectorAll("[data-shortcut]")];

if (year) {
  year.textContent = new Date().getFullYear();
}

const setEffects = (enabled) => {
  document.body.classList.toggle("fx-off", !enabled);
  fxToggle?.setAttribute("aria-pressed", String(enabled));

  if (fxLabel) {
    fxLabel.textContent = enabled ? "CRT FX: ON" : "CRT FX: OFF";
  }

  try {
    localStorage.setItem("elliott-crt-effects", enabled ? "on" : "off");
  } catch {
    // The preference is optional; the toggle still works without local storage.
  }
};

if (fxToggle) {
  let effectsEnabled = true;

  try {
    effectsEnabled = localStorage.getItem("elliott-crt-effects") !== "off";
  } catch {
    effectsEnabled = true;
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

  if (isTyping || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  const matchingLink = shortcutLinks.find((link) => link.dataset.shortcut === event.key);

  if (matchingLink) {
    event.preventDefault();
    document.querySelector(matchingLink.getAttribute("href"))?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }
});
