import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PROJECTS } from "../data/projects.mjs";
import { renderStudio } from "../scripts/generate-studio.mjs";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("studio project HTML matches the single source of project truth", () => {
  assert.equal(renderStudio(html), html, "run node scripts/generate-studio.mjs after changing project metadata");
  assert.equal(renderStudio(renderStudio(html)), html);
  for (const project of PROJECTS) {
    for (const attribute of ["data-demo", "data-source"]) {
      assert.equal(html.split(`${attribute}="${project.id}"`).length - 1, 1);
    }
    assert.ok(html.includes(project.description));
    assert.ok(html.includes(project.demo.url));
    assert.ok(html.includes(project.source));
    assert.ok(html.includes(`src="${project.image.src}"`));
  }
  const first = html.indexOf('id="architecture-lab"');
  const second = html.indexOf('id="glassbox"');
  const third = html.indexOf('id="pixel-language"');
  const more = html.indexOf('id="automata-lab"');
  assert.ok(first > 0 && first < second && second < third && third < more);
});

test("studio generator preserves handwritten introduction and safely escapes project edits", () => {
  const projects = structuredClone(PROJECTS);
  projects[0].description = "Inspect <each> step & result.";
  const changed = renderStudio(html, projects);
  assert.ok(changed.includes("Inspect &lt;each&gt; step &amp; result."));
  assert.equal(changed.slice(0, changed.indexOf("<!-- studio:featured -->")), html.slice(0, html.indexOf("<!-- studio:featured -->")));
  const duplicate = structuredClone(PROJECTS); duplicate[1].id = duplicate[0].id;
  assert.throws(() => renderStudio(html, duplicate), /unique safe IDs/);
  assert.throws(() => renderStudio(html, PROJECTS.slice(1)), /featured studio projects/);
  assert.throws(() => renderStudio(html.replace("<!-- studio:more -->", "")), /studio:more region/);
});
