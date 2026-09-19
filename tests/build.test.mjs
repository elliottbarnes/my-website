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

test("build publishes exactly 21 files and excludes unrelated source files", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, "private-notes.txt"), "not for publication");
  const destination = await buildSite({ root });
  assert.equal(PUBLIC_FILES.length, 21);
  assert.deepEqual(await inspectPublicTree(destination), [...PUBLIC_FILES].sort());
  const result = await verifySite(destination, { sourceRoot: root });
  assert.equal(result.files, 21);
  assert.equal(Object.keys(result.sha256).length, 21);
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

test("verification catches broken links, metadata, shortcuts, and initial controller states", async (t) => {
  const cases = [
    ["index.html", (s) => s.replace('href="#work"', 'href="#missing"'), /missing fragment/],
    ["index.html", (s) => s.replace(/src="\/script\.js(?:\?[^"]*)?"/, 'src="/unpublished.js"'), /not published/],
    ["index.html", (s) => s.replace('data-shortcut="2"', 'data-shortcut="1"'), /unique shortcuts/],
    ["index.html", (s) => s.replace(/<button\b[^>]*\bdata-fx-toggle\b[^>]*>/, (tag) => tag.replace('aria-pressed="false"', 'aria-pressed="true"')), /texture must start off/],
    ["index.html", (s) => s.replace(/<button\b[^>]*\bdata-theme-toggle\b[^>]*>/, (tag) => tag.replace('aria-pressed="false"', 'aria-pressed="true"')), /theme must start light/],
    ["index.html", (s) => s.replace(/<button\b[^>]*\bdata-theme-toggle\b[^>]*>/, (tag) => tag.replace('aria-label="START: Dark mode"', 'aria-label=""')), /theme must start light/],
    ["index.html", (s) => s.replace(/<button\b[^>]*\bdata-theme-toggle\b[^>]*>/, (tag) => tag.replace('type="button"', 'type="submit"')), /theme must start light/],
    ["index.html", (s) => s.replace('data-theme-label', 'data-missing-theme-label'), /theme must start light/],
    ["index.html", (s) => s.replace('data-theme="light"', 'data-theme="dark"'), /theme must start light/],
    ["index.html", (s) => s.replace('data-theme-label', 'data-theme-toggle data-theme-label'), /theme must start light/],
    ["index.html", (s) => s.replace('"@type": "Person"', '"@type":'), /invalid Person JSON-LD/],
    ["site.webmanifest", () => "{broken", /invalid JSON/],
    ["site.webmanifest", (s) => s.replace("/assets/dragon-ball.png", "/missing.png"), /not published/],
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

test("verification requires PNG favicon and Apple touch icon metadata on both HTML pages", async (t) => {
  for (const file of ["index.html", "404.html"]) {
    for (const rel of ["icon", "apple-touch-icon"]) {
      const tagPattern = new RegExp(`<link\\b[^>]*rel="${rel}"[^>]*>`);
      const changes = [
        () => "",
        (tag) => tag + tag,
        (tag) => tag.replace("/assets/dragon-ball.png", "/assets/favicon.svg"),
        (tag) => tag.replace('type="image/png"', 'type="image/svg+xml"'),
        (tag) => tag.replace('type="image/png"', ""),
        (tag) => tag.replace('sizes="256x256"', 'sizes="180x180"'),
        (tag) => tag.replace('sizes="256x256"', ""),
      ];
      for (const change of changes) {
        const root = await fixture(t);
        const path = join(root, file);
        const original = await readFile(path, "utf8");
        const modified = original.replace(tagPattern, change);
        assert.notEqual(modified, original, `Fixture must change ${file} ${rel}`);
        await writeFile(path, modified);
        await assert.rejects(verifySite(root), new RegExp(`expected exactly one ${rel} reference`));
      }
    }
  }
});

test("verification requires the matching PNG icon and dimensions in the manifest", async (t) => {
  const changes = [
    (manifest) => { manifest.icons = []; },
    (manifest) => { manifest.icons.push({ ...manifest.icons[0] }); },
    (manifest) => { manifest.icons[0].src = "/assets/favicon.svg"; },
    (manifest) => { manifest.icons[0].type = "image/svg+xml"; },
    (manifest) => { delete manifest.icons[0].type; },
    (manifest) => { manifest.icons[0].sizes = "180x180"; },
    (manifest) => { delete manifest.icons[0].sizes; },
  ];
  for (const change of changes) {
    const root = await fixture(t);
    const path = join(root, "site.webmanifest");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    change(manifest);
    await writeFile(path, JSON.stringify(manifest));
    await assert.rejects(verifySite(root), /site\.webmanifest: (missing name or icons|expected exactly one 256x256 image\/png Dragon Ball favicon)/);
  }
});

test("verification rejects malformed PNG headers and incorrect favicon dimensions", async (t) => {
  const changes = [
    [(bytes) => bytes.subarray(0, 24), /invalid PNG signature or IHDR header/],
    [(bytes) => { bytes[0] = 0; return bytes; }, /invalid PNG signature or IHDR header/],
    [(bytes) => { bytes.writeUInt32BE(12, 8); return bytes; }, /invalid PNG signature or IHDR header/],
    [(bytes) => { bytes.write("IDAT", 12, "ascii"); return bytes; }, /invalid PNG signature or IHDR header/],
    [(bytes) => { bytes.writeUInt32BE(128, 16); return bytes; }, /favicon must be 256x256 pixels/],
    [(bytes) => { bytes.writeUInt32BE(128, 20); return bytes; }, /favicon must be 256x256 pixels/],
  ];
  for (const [change, error] of changes) {
    const root = await fixture(t);
    const path = join(root, "assets/dragon-ball.png");
    await writeFile(path, change(await readFile(path)));
    await assert.rejects(verifySite(root), error);
  }
});

test("verification requires exactly one correctly content-versioned CSS and JS reference", async (t) => {
  for (const file of ["styles.css", "script.js"]) {
    const tagPattern = file === "styles.css" ? /<link\b[^>]*rel="stylesheet"[^>]*>/ : /<script\b[^>]*src="[^\"]*"[^>]*><\/script>/;
    const attributePattern = file === "styles.css" ? /href="[^"]*"/ : /src="[^"]*"/;
    const attribute = file === "styles.css" ? "href" : "src";
    const changes = [
      (tag) => tag.replace(attributePattern, `${attribute}="/${file}"`),
      (tag) => tag.replace(attributePattern, `${attribute}="/${file}?v=000000000000"`),
      (tag) => tag.replace(attributePattern, `${attribute}="/${file}?v=wrong-version"`),
      (tag) => tag.replace("?v=", "?release="),
      (tag) => tag.replace(attributePattern, (value) => value.slice(0, -1) + '&extra=1"'),
      (tag) => tag + tag,
      () => "",
    ];
    for (const change of changes) {
      const root = await fixture(t);
      const path = join(root, "index.html");
      const original = await readFile(path, "utf8");
      const modified = original.replace(tagPattern, change);
      assert.notEqual(modified, original, `Fixture must change the ${file} reference`);
      await writeFile(path, modified);
      await assert.rejects(verifySite(root), new RegExp(`${file.replace(".", "\\.")} must have exactly one reference with its content hash`));
    }
  }
});

test("verification rejects CSS or JS edits unless their HTML content version is updated", async (t) => {
  for (const file of ["styles.css", "script.js"]) {
    const root = await fixture(t);
    const path = join(root, file);
    await writeFile(path, await readFile(path, "utf8") + "\n/* changed bytes */\n");
    await assert.rejects(verifySite(root), new RegExp(`${file.replace(".", "\\.")} must have exactly one reference with its content hash`));
  }
});

test("verification requires the content-versioned script to remain deferred", async (t) => {
  for (const change of [(tag) => tag.replace(" defer", ""), (tag) => tag.replace(" defer", " defer async")]) {
    const root = await fixture(t);
    const path = join(root, "index.html");
    await writeFile(path, (await readFile(path, "utf8")).replace(/<script\b[^>]*src="[^"]*"[^>]*>/, change));
    await assert.rejects(verifySite(root), /script\.js must use defer without async/);
  }
});
