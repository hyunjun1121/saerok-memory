import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createDay1SelectorServer } from "./server.mjs";

function fixture() {
  const rootDirectory = mkdtempSync(join(tmpdir(), "haru-day1-server-"));
  mkdirSync(join(rootDirectory, "audio"));
  writeFileSync(join(rootDirectory, "index.html"), "<!doctype html><title>selector</title>");
  writeFileSync(join(rootDirectory, "app.js"), "console.log('selector')");
  writeFileSync(join(rootDirectory, "styles.css"), "body { color: black; }");
  writeFileSync(join(rootDirectory, "audio", "01_left.mp3"), "left");
  writeFileSync(join(rootDirectory, "audio", "01_right.mp3"), "right");
  writeFileSync(join(rootDirectory, "day1-inventory.json"), JSON.stringify({
    schemaVersion: 1,
    locale: "ko",
    entryCount: 1,
    entries: [{
      index: 1,
      id: "day.1.greeting",
      text: "첫 문장",
      leftTargetPath: "audio/01_left.mp3",
      rightTargetPath: "audio/01_right.mp3",
    }],
  }));
  return {
    rootDirectory,
    selectionsPath: join(rootDirectory, "day1-selections.json"),
  };
}

async function withServer(run) {
  const paths = fixture();
  const server = createDay1SelectorServer(paths);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`, paths);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("serves only selector assets and supports audio range requests", async () => {
  await withServer(async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/styles.css`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/day1-inventory.json`)).status, 200);
    const partial = await fetch(`${baseUrl}/audio/01_left.mp3`, {
      headers: { Range: "bytes=0-1" },
    });
    assert.equal(partial.status, 206);
    assert.equal(await partial.text(), "le");
    assert.equal((await fetch(`${baseUrl}/selectionStore.mjs`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/../package.json`)).status, 404);
  });
});

test("persists canonical selections through the local API", async () => {
  await withServer(async (baseUrl, paths) => {
    const empty = await fetch(`${baseUrl}/api/selections`);
    assert.equal(empty.status, 200);
    assert.equal((await empty.json()).selectedCount, 0);

    const saved = await fetch(`${baseUrl}/api/selections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections: { "day.1.greeting": "right" } }),
    });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).selections[0].audioPath, "audio/01_right.mp3");
    assert.equal(JSON.parse(readFileSync(paths.selectionsPath, "utf8")).selectedCount, 1);

    const invalid = await fetch(`${baseUrl}/api/selections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections: { "day.1.greeting": "middle" } }),
    });
    assert.equal(invalid.status, 400);
  });
});
