import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PROJECTS, FEATURED_PROJECT_ID } from "../data/projects.mjs";
import { renderProjects } from "../scripts/generate-projects.mjs";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("checked-in project HTML matches the manifest and generation is idempotent", () => {
  const generated = renderProjects(html);
  assert.equal(generated, html, "run node scripts/generate-projects.mjs after changing project metadata");
  assert.equal(renderProjects(generated), generated);
  assert.ok(generated.includes(`data-enter href="#${FEATURED_PROJECT_ID}"`));
  assert.doesNotMatch(generated, /github-stat|Public GitHub snapshot/);
  assert.match(generated, /ai wizard/);
  assert.match(generated, /a computer can be a bicycle for the mind/);
});

test("each static project has one panel, selector, radar signal, command and valid outbound actions", () => {
  for (const project of PROJECTS) {
    for (const attribute of ["data-panel", "data-select", "data-radar-route", "data-command", "data-demo", "data-source"]) {
      assert.equal(html.split(`${attribute}="${project.id}"`).length - 1, 1, `${attribute}: ${project.id}`);
    }
    assert.ok(html.includes(`href="#${project.id}"`));
    assert.ok(html.includes(`href="${project.demo.url}"`));
    assert.ok(html.includes(`href="${project.source}"`));
    assert.ok(html.includes(`data-project-search="${project.search}"`));
  }
});

test("a metadata edit reaches every generated surface while preserving handwritten content", () => {
  const projects = structuredClone(PROJECTS);
  projects[0].title = "compiler & inspector";
  projects[0].displayName = "Compiler & Inspector";
  projects[0].label = "inspector";
  projects[0].search = "new compiler keywords";
  projects[0].description = "Inspect <each> step.";
  const changed = renderProjects(html, projects);
  assert.match(changed, /<span>inspector<\/span>/);
  assert.match(changed, /<span class="radar-tooltip">Compiler &amp; Inspector<\/span>/);
  assert.match(changed, /<h2 id="glassbox-title">compiler &amp; inspector<\/h2>/);
  assert.match(changed, /data-command="glassbox">compiler &amp; inspector<\/button>/);
  assert.match(changed, /data-project-search="new compiler keywords"/);
  assert.match(changed, /Inspect &lt;each&gt; step\./);
  assert.equal(changed.slice(changed.indexOf('<dialog id="training-dialog"')), html.slice(html.indexOf('<dialog id="training-dialog"')));
});

test("generation refuses ambiguous IDs or missing regions instead of silently dropping content", () => {
  const duplicate = [...PROJECTS]; duplicate[1] = PROJECTS[0];
  assert.throws(() => renderProjects(html, duplicate), /unique safe IDs/);
  assert.throws(() => renderProjects(html, PROJECTS, "missing"), /Featured project/);
  assert.throws(() => renderProjects(html.replace("<!-- projects:panels -->", "")), /projects:panels region/);
});
