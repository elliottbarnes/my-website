import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildSite } from "../build.mjs";
import { PUBLIC_FILES, VERSIONED_FILES, inspectPublicTree } from "../scripts/public-files.mjs";
import { cacheControl, digest, manifestPath, publishedPath, readArtifactManifest, ROOT_FILES } from "../scripts/artifact.mjs";
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
async function built(t) {
  const root = await fixture(t), directory = await buildSite({ root });
  const manifest = await readArtifactManifest(directory);
  return { root, directory, manifest, path: source => join(directory, manifest.assets[source].path) };
}

test("deterministic build publishes only declared content under safe hashed paths", async t => {
  const root = await fixture(t);
  await writeFile(join(root, "private-notes.txt"), "private");
  const directory = await buildSite({ root });
  const first = await readArtifactManifest(directory);
  assert.deepEqual(Object.keys(first.assets), PUBLIC_FILES);
  assert.deepEqual(VERSIONED_FILES, PUBLIC_FILES.filter(file => /\.(?:css|js)$/.test(file)));
  for (const [source, { path, sha256 }] of Object.entries(first.assets)) {
    assert.equal(path, publishedPath(source, sha256));
    assert.equal(digest(await readFile(join(directory, path))), sha256);
    if (!ROOT_FILES.includes(source)) assert.match(path, /^assets\/.*\.[a-f0-9]{12}\.[a-z0-9]+$/);
  }
  await assert.rejects(readFile(join(directory, "private-notes.txt")), { code: "ENOENT" });
  await assert.rejects(readFile(join(directory, "dist.manifest.json")), { code: "ENOENT" });
  await assert.rejects(readFile(join(directory, "styles.css")), { code: "ENOENT" });
  const result = await verifySite(directory, { sourceRoot: root });
  assert.equal(result.files, PUBLIC_FILES.length);
  assert.equal(result.publication.length, PUBLIC_FILES.length);
  await buildSite({ root });
  assert.deepEqual(await readArtifactManifest(directory), first);
});

test("build rewrites CSS fonts, HTML images, and lazy script/style dependency URLs", async t => {
  const { directory, manifest, path } = await built(t);
  const html = await readFile(path("index.html"), "utf8");
  const css = await readFile(path("styles.css"), "utf8");
  assert.ok(html.includes('/' + manifest.assets["assets/fonts/IBMPlexMono-Regular.woff2"].path));
  assert.ok(css.includes('/' + manifest.assets["assets/fonts/IBMPlexMono-Regular.woff2"].path));
  assert.ok(html.includes('/' + manifest.assets["assets/dragon-ball.png"].path));
  const loader = await readFile(path("assets/optional-games.js"), "utf8");
  for (const source of ["assets/piccolo-lookout.js", "assets/piccolo.css", "assets/goku-platformer.js", "assets/goku-platformer.css", "assets/arcade.css"]) {
    assert.ok(loader.includes('/' + manifest.assets[source].path), source);
    assert.ok(!html.includes('/' + manifest.assets[source].path), `${source} must load on demand`);
  }
  for (const source of ["assets/hidden-games.js", "assets/training-chamber.js"]) {
    const game = await readFile(path(source), "utf8");
    for (let i = 1; i <= 7; i++) assert.ok(game.includes('/' + manifest.assets[`assets/dragon-ball-${i}.webp`].path));
  }
  assert.equal(cacheControl(manifest.assets["styles.css"].path), "public,max-age=31536000,immutable");
  for (const file of ROOT_FILES) assert.equal(cacheControl(file), "no-cache,max-age=0,must-revalidate");
  await verifySite(directory);
});

test("nested changes alter dependent filenames while unrelated assets stay stable", async t => {
  const { root, directory, manifest } = await built(t);
  await writeFile(join(root, "assets/piccolo-lookout.js"), await readFile(join(root, "assets/piccolo-lookout.js"), "utf8") + "\n// revision\n");
  await buildSite({ root });
  const next = await readArtifactManifest(directory);
  for (const file of ["assets/piccolo-lookout.js", "assets/optional-games.js"]) assert.notEqual(next.assets[file].path, manifest.assets[file].path);
  assert.notEqual(next.assets["index.html"].sha256, manifest.assets["index.html"].sha256);
  assert.equal(next.assets["assets/dragon-ball.png"].path, manifest.assets["assets/dragon-ball.png"].path);
  await assert.rejects(readFile(join(directory, manifest.assets["assets/piccolo-lookout.js"].path)), { code: "ENOENT" });
  await verifySite(directory, { sourceRoot: root });
});

test("rebuild accepts bounded prior manifests after allowlist evolution", async t => {
  const { root, directory, manifest } = await built(t);
  const bytes = Buffer.from("old asset"), sha256 = digest(bytes);
  const old = publishedPath("assets/retired.js", sha256);
  manifest.assets["assets/retired.js"] = { path: old, sha256 };
  await writeFile(join(directory, old), bytes);
  await writeFile(manifestPath(directory), JSON.stringify(manifest));
  await assert.rejects(verifySite(directory), /exact source allowlist/);
  await buildSite({ root });
  await assert.rejects(readFile(join(directory, old)), { code: "ENOENT" });
  await verifySite(directory, { sourceRoot: root });
});

test("unexpected output, source symlinks and missing sources fail before changing output", async t => {
  for (const kind of ["extra", "source-symlink", "missing"]) {
    const { root, directory } = await built(t);
    const original = await readFile(join(directory, "index.html"));
    if (kind === "extra") await writeFile(join(directory, "secret.txt"), "preserve");
    else {
      await rm(join(root, "assets/dragon-ball.png"));
      if (kind === "source-symlink") await symlink(join(project, "assets/dragon-ball.png"), join(root, "assets/dragon-ball.png"));
    }
    await assert.rejects(buildSite({ root }), /Unexpected artifact|Symlink|ENOENT/);
    assert.deepEqual(await readFile(join(directory, "index.html")), original);
  }
});

test("source and output directory/file/manifest symlinks are rejected", async t => {
  for (const kind of ["root", "directory", "file", "manifest"]) {
    const { root, directory, manifest } = await built(t);
    if (kind === "root") {
      const alias = join(root, "linked"); await symlink(root, alias, "dir");
      await assert.rejects(buildSite({ root: alias }), /Symlink/); continue;
    }
    if (kind === "manifest") {
      await rm(manifestPath(directory)); await symlink(join(root, "index.html"), manifestPath(directory));
    } else if (kind === "directory") {
      await rm(join(directory, "assets"), { recursive: true }); await symlink(join(root, "assets"), join(directory, "assets"), "dir");
    } else {
      const path = join(directory, manifest.assets["styles.css"].path);
      await rm(path); await symlink(join(root, "styles.css"), path);
    }
    await assert.rejects(buildSite({ root }), /Symlink|regular file/);
  }
});

test("artifact verification catches tampering, source drift, missing assets, and unsafe manifest paths", async t => {
  for (const kind of ["tamper", "source", "missing", "manifest", "sidecar"]) {
    const { root, directory, manifest, path } = await built(t);
    if (kind === "tamper") await writeFile(path("assets/piccolo-lookout.js"), "tampered");
    if (kind === "source") await writeFile(join(root, "styles.css"), "body { color: red }");
    if (kind === "missing") await rm(path("assets/piccolo-lookout.js"));
    if (kind === "manifest") { manifest.assets["styles.css"].path = "../private.css"; await writeFile(manifestPath(directory), JSON.stringify(manifest)); }
    if (kind === "sidecar") await rm(manifestPath(directory));
    await assert.rejects(verifySite(directory, { sourceRoot: root }), /hash mismatch|differs from source|Missing public|Invalid artifact|requires its private manifest/);
  }
});

test("build refuses dynamic URLs and cyclic asset dependencies", async t => {
  for (const source of ['const image = `/assets/dragon-ball-${star}.webp`;', 'const source = "/assets/optional-games.js";']) {
    const root = await fixture(t);
    await writeFile(join(root, "assets/optional-games.js"), source);
    await assert.rejects(buildSite({ root }), /complete literal|Cyclic asset/);
  }
});

test("source validation catches broken references, metadata, and eager script attributes", async t => {
  const cases = [
    ["index.html", text => text.replace('href="#about"', 'href="#missing"'), /missing fragment/],
    ["index.html", text => text.replace('"@type": "Person"', '"@type":'), /invalid Person JSON-LD/],
    ["index.html", text => text.replace(/ defer><\/script>/, ' async></script>'), /must use defer/],
    ["site.webmanifest", () => "{broken", /invalid JSON/],
    ["styles.css", text => text + '\nbody{background:url("/missing.png")}', /not published/],
    ["assets/optional-games.js", text => text + '\nconst missing = "/assets/missing.js";', /not published/],
  ];
  for (const [file, change, error] of cases) {
    const root = await fixture(t), path = join(root, file), original = await readFile(path, "utf8");
    const modified = change(original); assert.notEqual(modified, original);
    await writeFile(path, modified);
    await assert.rejects(verifySite(root), error);
  }
});

test("build preserves descriptive text and external source URLs", async t => {
  const root = await fixture(t);
  const suffix = '\nconst label = "assets are at /assets/piccolo-lookout.js";\nconst external = "https://example.com/assets/piccolo-lookout.js";\n';
  await writeFile(join(root, "assets/piccolo-lookout.js"), await readFile(join(root, "assets/piccolo-lookout.js"), "utf8") + suffix);
  const directory = await buildSite({ root }), manifest = await readArtifactManifest(directory);
  assert.ok((await readFile(join(directory, manifest.assets["assets/piccolo-lookout.js"].path), "utf8")).endsWith(suffix));
});

test("changing a cartridge stylesheet updates its lazy loader and entrypoint without changing other games", async t => {
  const { root, directory, manifest } = await built(t);
  const css = "assets/piccolo.css";
  await writeFile(join(root, css), await readFile(join(root, css), "utf8") + "\n/* cartridge revision */\n");
  await buildSite({ root });
  const next = await readArtifactManifest(directory);
  assert.notEqual(next.assets[css].path, manifest.assets[css].path);
  assert.notEqual(next.assets["assets/optional-games.js"].path, manifest.assets["assets/optional-games.js"].path);
  assert.notEqual(next.assets["index.html"].sha256, manifest.assets["index.html"].sha256);
  for (const source of ["assets/piccolo-lookout.js", "assets/goku-platformer.js", "assets/goku-platformer.css", "assets/brick-breaker.js", "assets/training-chamber.js"]) {
    assert.equal(next.assets[source].path, manifest.assets[source].path, source);
  }
  await verifySite(directory, { sourceRoot: root });
});
