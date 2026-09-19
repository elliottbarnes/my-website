import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildSite } from "../build.mjs";
import { PUBLIC_FILES, inspectPublicTree } from "../scripts/public-files.mjs";
import { verifySite } from "../scripts/verify-site.mjs";

const project = fileURLToPath(new URL("..", import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "portfolio-build-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const file of PUBLIC_FILES) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await copyFile(join(project, file), join(root, file));
  }
  return root;
}

test("build publishes exactly 20 files and excludes unrelated source files", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, "private-notes.txt"), "not for publication");
  const destination = await buildSite({ root });
  assert.equal(PUBLIC_FILES.length, 20);
  assert.deepEqual(await inspectPublicTree(destination), [...PUBLIC_FILES].sort());
  const result = await verifySite(destination, { sourceRoot: root });
  assert.equal(result.files, 20);
  assert.equal(Object.keys(result.sha256).length, 20);
  assert.match(result.sha256["index.html"], /^[a-f0-9]{64}$/);
});

test("rebuilding updates allowed content without deleting unexpected artifacts", async (t) => {
  const root = await fixture(t);
  const destination = await buildSite({ root });
  const original = await readFile(join(destination, "index.html"));
  await writeFile(join(destination, "secret.txt"), "keep this evidence");
  await writeFile(join(root, "index.html"), "replacement");
  await assert.rejects(buildSite({ root }), /Unexpected artifact: secret.txt/);
  assert.deepEqual(await readFile(join(destination, "index.html")), original);
  assert.equal(await readFile(join(destination, "secret.txt"), "utf8"), "keep this evidence");
});

test("build rejects symlinks in destination files, directories, and root", async (t) => {
  for (const kind of ["file", "directory", "root"]) {
    const root = await fixture(t);
    const destination = join(root, "dist");
    if (kind === "root") {
      await symlink(root, destination, "dir");
    } else {
      await mkdir(destination);
      if (kind === "file") await symlink(join(root, "index.html"), join(destination, "index.html"));
      else await symlink(join(root, "assets"), join(destination, "assets"), "dir");
    }
    await assert.rejects(buildSite({ root }), /Symlink|real directory/);
  }
});

test("build rejects source file and parent-directory symlinks before writing", async (t) => {
  for (const kind of ["file", "directory"]) {
    const root = await fixture(t);
    if (kind === "file") {
      await rm(join(root, "index.html"));
      await symlink(join(project, "index.html"), join(root, "index.html"));
    } else {
      await rm(join(root, "assets"), { recursive: true });
      await symlink(join(project, "assets"), join(root, "assets"), "dir");
    }
    await assert.rejects(buildSite({ root }), /Symlink is not permitted/);
    await assert.rejects(readFile(join(root, "dist", "index.html")), { code: "ENOENT" });
  }
});

test("build rejects a symlink used as its source root", async (t) => {
  const directory = await fixture(t);
  const linkedRoot = join(directory, "linked-source");
  await symlink(project, linkedRoot, "dir");
  await assert.rejects(buildSite({ root: linkedRoot }), /Symlink is not permitted/);
});

test("build rejects a missing source before modifying existing output", async (t) => {
  const root = await fixture(t);
  const destination = await buildSite({ root });
  const original = await readFile(join(destination, "index.html"));
  await writeFile(join(root, "index.html"), "replacement");
  await rm(join(root, "assets/toolkit/LICENSE.txt"));
  await assert.rejects(buildSite({ root }), { code: "ENOENT" });
  assert.deepEqual(await readFile(join(destination, "index.html")), original);
});

test("verification rejects missing, extra, and symlink artifacts", async (t) => {
  for (const kind of ["missing", "extra", "symlink"]) {
    const root = await fixture(t);
    const destination = await buildSite({ root });
    if (kind === "extra") await writeFile(join(destination, "notes.txt"), "not public");
    else {
      await rm(join(destination, "styles.css"));
      if (kind === "symlink") await symlink(join(root, "styles.css"), join(destination, "styles.css"));
    }
    await assert.rejects(verifySite(destination), /Missing public|Unexpected artifact|Symlink/);
  }
});

test("verification rejects source/build drift", async (t) => {
  const root = await fixture(t);
  const destination = await buildSite({ root });
  await writeFile(join(root, "styles.css"), "body { color: red; }");
  await assert.rejects(verifySite(destination, { sourceRoot: root }), /differs from source: styles.css/);
});

test("verification catches broken links, metadata, shortcuts, and initial texture state", async (t) => {
  const cases = [
    ["index.html", (s) => s.replace('href="#work"', 'href="#missing"'), /missing fragment/],
    ["index.html", (s) => s.replace('src="/script.js"', 'src="/unpublished.js"'), /not published/],
    ["index.html", (s) => s.replace('data-shortcut="2"', 'data-shortcut="1"'), /unique shortcuts/],
    ["index.html", (s) => s.replace('aria-pressed="false"', 'aria-pressed="true"'), /texture must start off/],
    ["index.html", (s) => s.replace('"@type": "Person"', '"@type":'), /invalid Person JSON-LD/],
    ["site.webmanifest", () => "{broken", /invalid JSON/],
    ["site.webmanifest", (s) => s.replace("/assets/favicon.svg", "/missing.svg"), /not published/],
    ["index.html", (s) => s.replace("https://elliottbarnes.ca/assets/social-card.svg", "https://elliottbarnes.ca/missing.svg"), /not published/],
    ["styles.css", (s) => s + '\nbody{background:url("/missing.svg")}\n', /not published/],
  ];
  for (const [file, change, error] of cases) {
    const root = await fixture(t);
    const destination = await buildSite({ root });
    const path = join(destination, file);
    await writeFile(path, change(await readFile(path, "utf8")));
    await assert.rejects(verifySite(destination), error);
  }
});
