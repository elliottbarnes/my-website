import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PROJECTS } from "../data/projects.mjs";
import { renderReplica } from "../scripts/generate-replica.mjs";

test("the replica has all authoritative project destinations and idempotent static content", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.equal(renderReplica(html), html, "run node scripts/generate-replica.mjs after metadata changes");
  for (const project of PROJECTS) {
    assert.equal(html.split(`data-demo="${project.id}"`).length - 1, 1);
    assert.equal(html.split(`data-source="${project.id}"`).length - 1, 1);
    assert.ok(html.includes(project.demo.url));
    assert.ok(html.includes(project.source));
    assert.ok(html.includes(project.description));
    assert.ok(html.includes(project.image.src));
  }
});

test("replica generation escapes changed metadata and preserves handwritten biography", () => {
  const template = '<p>handwritten biography</p><!-- REPLICA_PROJECTS:START --><!-- REPLICA_PROJECTS:END -->';
  const projects = structuredClone(PROJECTS);
  projects[0].displayName = 'A <new> & useful project';
  projects[0].description = 'Inspect "every" step.';
  const generated = renderReplica(template, projects);
  assert.match(generated, /A &lt;new&gt; &amp; useful project/);
  assert.match(generated, /Inspect &quot;every&quot; step\./);
  assert.match(generated, /^<p>handwritten biography<\/p>/);
  assert.equal(renderReplica(generated, projects), generated);
  assert.throws(() => renderReplica(template, [PROJECTS[0], PROJECTS[0]]), /unique safe IDs/);
  assert.throws(() => renderReplica(template.replace('REPLICA_PROJECTS:END', 'missing')), /bounded REPLICA_PROJECTS/);
});
