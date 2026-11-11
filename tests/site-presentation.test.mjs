import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const metadata = new Map([...html.matchAll(/<meta\s+(?:name|property)="([^"]+)"\s+content="([^"]*)"/g)]
  .map(([, name, content]) => [name, content]));
const person = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

test("identity and role agree across the static information, structured data and share metadata", () => {
  const title = html.match(/<title>(.*?)<\/title>/)[1];
  assert.equal(person["@type"], "Person");
  assert.equal(html.match(/<h1>([^<]+)<\/h1>/)[1], person.name);
  assert.equal(html.match(/<p class="role">([^<]+)<br>/)[1], person.jobTitle);
  for (const value of [title, metadata.get("description"), metadata.get("og:title"), metadata.get("twitter:title")]) {
    assert.ok(value.includes(person.name), "public metadata identifies the same person");
    assert.ok(value.includes(person.jobTitle), "the role remains consistent");
  }
  assert.equal(html.match(/<link rel="canonical" href="([^"]+)"/)[1], person.url);
  assert.equal(metadata.get("og:url"), person.url);
});

test("sharing metadata points to the same local PNG and declares its actual dimensions", async () => {
  const image = new URL(metadata.get("og:image"));
  assert.equal(image.origin, new URL(person.url).origin);
  assert.equal(metadata.get("twitter:image"), image.href);
  assert.equal(metadata.get("og:image:type"), "image/png");
  assert.equal(metadata.get("twitter:card"), "summary_large_image");
  const bytes = await readFile(new URL(`..${image.pathname}`, import.meta.url));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.readUInt32BE(16), Number(metadata.get("og:image:width")));
  assert.equal(bytes.readUInt32BE(20), Number(metadata.get("og:image:height")));
  for (const key of ["og:image:alt", "twitter:image:alt"]) assert.ok(metadata.get(key).includes(person.name));
});
