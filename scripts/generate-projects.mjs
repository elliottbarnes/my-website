import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FEATURED_PROJECT_ID, PROJECTS } from "../data/projects.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const escape = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const number = index => String(index + 1).padStart(2, "0");
const image = (project, screenshot = false) => `<img${screenshot ? ' class="project-screenshot"' : ""} src="${escape(project.image.src)}" width="${project.image.width}" height="${project.image.height}" alt="${screenshot ? escape(project.image.alt) : ""}" loading="lazy" decoding="async">`;

function panel(project, index) {
  const experiment = project.experiment ? ` data-experiment="${escape(project.experiment.kind)}" data-experiment-label="${escape(project.experiment.label)}"` : "";
  return `<article id="${project.id}" class="terminal-panel" data-panel="${project.id}" data-project-label="${escape(project.label)}" data-project-aliases="${escape(project.aliases.join(" "))}" data-project-search="${escape(project.search)}"${experiment} tabindex="-1" aria-labelledby="${project.titleId}">
              <p class="prompt"><span>elliott@dev</span> ~/projects <span class="prompt-command">› open ${project.id}</span></p><p class="project-kind">${number(index)} / ${escape(project.kind)}</p><h2 id="${project.titleId}">${escape(project.title)}</h2><p class="project-description">${escape(project.description)}</p>
              <div class="project-actions"><a data-demo="${project.id}" href="${escape(project.demo.url)}" aria-label="${escape(project.demo.ariaLabel)}">${escape(project.demo.label)}</a><a data-source="${project.id}" href="${escape(project.source)}" aria-label="${escape(project.displayName)} source on GitHub">source ↗</a></div>
              ${image(project, true)}<div class="code-preview"><div>${escape(project.preview.label)}</div>${project.preview.html ? `<pre><code>${project.preview.html}</code></pre>` : ""}</div>
            </article>`;
}

// Replace bounded generated regions only. Handwritten identity, controls and
// dialog markup remain outside the generator and ordinary anchors work offline.
export function renderProjects(html, projects = PROJECTS, featuredId = FEATURED_PROJECT_ID) {
  const ids = projects.map(project => project.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !/^[a-z][a-z0-9-]*$/.test(id))) throw new Error("Projects need unique safe IDs");
  if (projects.length !== 7) throw new Error("The project radar requires seven project signals");
  const featured = projects.find(project => project.id === featuredId);
  if (!featured) throw new Error("Featured project must exist in the project list");
  const blocks = {
    navigation: projects.map((project, index) => `<button type="button" data-select="${project.id}" aria-pressed="false">${image(project)}<span class="file-index">${number(index)}</span><span>${escape(project.label)}</span><span class="file-extension">/</span></button>`).join("\n              "),
    radar: projects.map((project, index) => `<a class="radar-signal" data-radar-route="${project.id}" href="#${project.id}" aria-label="${index + 1}-star dragon ball: open ${escape(project.displayName)}"><img src="/assets/dragon-ball-${index + 1}.webp" width="128" height="128" alt="" loading="lazy" decoding="async"><span class="radar-tooltip">${escape(project.displayName)}</span></a>`).join("\n                  "),
    legend: `<div class="radar-legend" aria-hidden="true"><span>project signals</span>${projects.map(project => `<p>${escape(project.title)}</p>`).join("")}<small>select a dragon ball</small></div>`,
    links: `<div class="about-projects">${projects.map(project => `<a href="#${project.id}">${escape(project.id)}/</a>`).join("")}</div>`,
    panels: projects.map(panel).join("\n            "),
    commands: projects.map(project => `<button type="button" data-command="${project.id}">${escape(project.title)}</button>`).join(""),
    featured: `<a class="enter-link" data-enter href="#${featured.id}">explore projects <span aria-hidden="true">↵</span></a>`,
    "scene-links": `<nav class="scene-project-links" aria-label="Explore the current source project">
              <a data-scene-source href="${escape(featured.source)}">source ↗</a>
              <button type="button" data-scene-try hidden>try ${escape(featured.experiment?.label || "sketch")}</button>
              <a data-scene-demo href="${escape(featured.demo.url)}" aria-label="${escape(featured.demo.ariaLabel)}">${escape(featured.demo.label)}</a>
            </nav>`,
  };
  for (const [name, content] of Object.entries(blocks)) {
    const start = `<!-- projects:${name} -->`, end = `<!-- /projects:${name} -->`;
    if (html.split(start).length !== 2 || html.split(end).length !== 2) throw new Error(`Expected one projects:${name} region`);
    const first = html.indexOf(start), last = html.indexOf(end);
    if (last < first) throw new Error(`Invalid projects:${name} region`);
    html = html.slice(0, first + start.length) + "\n" + content + "\n" + html.slice(last);
  }
  return html;
}

export async function generateProjects({ root = projectRoot, destination = join(root, "index.html") } = {}) {
  const html = renderProjects(await readFile(join(root, "index.html"), "utf8"));
  await writeFile(destination, html);
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateProjects();
  console.log(`Generated ${PROJECTS.length} projects in index.html.`);
}
