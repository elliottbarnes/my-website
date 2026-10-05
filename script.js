// All navigation works without JavaScript. This is the only enhancement.
const year = document.querySelector("[data-current-year]");
if (year) year.textContent = String(new Date().getFullYear());
