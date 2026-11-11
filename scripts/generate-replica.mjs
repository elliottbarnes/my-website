import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECTS } from "../data/projects.mjs";

const escape = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

// The interactive scene has a normal, generated HTML project index underneath.
// Keep destinations and descriptions authoritative in data/projects.mjs.
export function renderReplica(html, projects = PROJECTS) {
  const start = "<!-- REPLICA_PROJECTS:START -->";
  const end = "<!-- REPLICA_PROJECTS:END -->";
  if (html.split(start).length !== 2 || html.split(end).length !== 2 || html.indexOf(end) < html.indexOf(start)) {
    throw new Error("Expected one bounded REPLICA_PROJECTS region");
  }
  const ids = projects.map(project => project.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !/^[a-z][a-z0-9-]*$/.test(id))) {
    throw new Error("Projects need unique safe IDs");
  }
  const cards = projects.map(project => `<article class="replica-project" id="project-${project.id}">
  <img src="${escape(project.image.src)}" width="${project.image.width}" height="${project.image.height}" alt="${escape(project.image.alt)}" loading="lazy" decoding="async">
  <h3>${escape(project.displayName)}</h3>
  <p>${escape(project.description)}</p>
  <div class="project-links"><a data-demo="${project.id}" href="${escape(project.demo.url)}" aria-label="${escape(project.demo.ariaLabel)}">demo ↗</a><a data-source="${project.id}" href="${escape(project.source)}" aria-label="${escape(project.displayName)} source on GitHub">source ↗</a></div>
</article>`).join("\n");
  return html.slice(0, html.indexOf(start) + start.length) + "\n" + cards + "\n" + html.slice(html.indexOf(end));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = new URL("../index.html", import.meta.url);
  await writeFile(path, renderReplica(await readFile(path, "utf8")));
  console.log(`Generated ${PROJECTS.length} projects in index.html.`);
}
