import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECTS } from "../data/projects.mjs";

const rootDirectory = fileURLToPath(new URL("../", import.meta.url));
const escape = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const featuredIds = ["architecture-lab", "glassbox", "pixel-language"];

function projectCard(project, index, featured) {
  return `<article class="studio-project ${featured ? `feature-${project.id}` : "more-project"}" id="${project.id}" aria-labelledby="${project.titleId}">
  <a class="project-image-wrap" href="${escape(project.demo.url)}" aria-label="Open ${escape(project.displayName)} live demo preview"><img src="${escape(project.image.src)}" width="${project.image.width}" height="${project.image.height}" alt="${escape(project.image.alt)}" loading="lazy" decoding="async"></a>
  <div class="project-info">
    <p class="eyebrow">${String(index + 1).padStart(2, "0")} / ${escape(project.kind)}</p>
    <h3 id="${project.titleId}">${escape(project.displayName)}</h3>
    <p class="project-description">${escape(project.description)}</p>
    <div class="project-links"><a data-demo="${project.id}" href="${escape(project.demo.url)}" aria-label="${escape(project.demo.ariaLabel)}">Live demo <span aria-hidden="true">↗</span></a><a data-source="${project.id}" href="${escape(project.source)}" aria-label="${escape(project.displayName)} source on GitHub">Source code <span aria-hidden="true">↗</span></a></div>
  </div>
</article>`;
}

// Ordinary HTML is the deliverable; enhancement never gates project access.
export function renderStudio(html, projects = PROJECTS) {
  const ids = projects.map(project => project.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !/^[a-z][a-z0-9-]*$/.test(id))) throw new Error("Projects need unique safe IDs");
  if (!featuredIds.every(id => ids.includes(id))) throw new Error("The three featured studio projects must exist");
  const featured = featuredIds.map(id => projects.find(project => project.id === id));
  const more = projects.filter(project => !featuredIds.includes(project.id));
  for (const [name, list] of [["featured", featured], ["more", more]]) {
    const start = `<!-- studio:${name} -->`, end = `<!-- /studio:${name} -->`;
    if (html.split(start).length !== 2 || html.split(end).length !== 2 || html.indexOf(end) < html.indexOf(start)) {
      throw new Error(`Expected one ordered studio:${name} region`);
    }
    const cards = list.map((project, index) => projectCard(project, index + (name === "more" ? featured.length : 0), name === "featured")).join("\n");
    html = html.slice(0, html.indexOf(start) + start.length) + "\n" + cards + "\n" + html.slice(html.indexOf(end));
  }
  return html;
}

export async function generateStudio({ root = rootDirectory, destination = join(root, "index.html") } = {}) {
  const html = renderStudio(await readFile(join(root, "index.html"), "utf8"));
  await writeFile(destination, html);
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateStudio();
  console.log(`Generated ${PROJECTS.length} studio projects in index.html.`);
}
