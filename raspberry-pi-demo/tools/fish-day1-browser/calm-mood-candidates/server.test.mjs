import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createCalmMoodSelectorServer } from "./server.mjs";

function createFixture() {
  const rootDirectory = mkdtempSync(join(tmpdir(), "haru-calm-tts-server-"));
  mkdirSync(join(rootDirectory, "audio"));
  writeFileSync(join(rootDirectory, "index.html"), "<!doctype html><title>selector</title>");
  writeFileSync(join(rootDirectory, "app.js"), "console.log('selector')");
  writeFileSync(join(rootDirectory, "styles.css"), "body { color: black; }");
  writeFileSync(join(rootDirectory, "audio", "A_calm_soft_left.mp3"), "left");
  writeFileSync(join(rootDirectory, "audio", "A_calm_soft_right.mp3"), "right");
  writeFileSync(join(rootDirectory, "manifest.json"), JSON.stringify({
    schemaVersion: 1,
    locale: "ko",
    candidateCountPerOption: 2,
    manualTags: [{ id: "calm_soft", text: "차분하고 부드럽게" }],
    options: [{
      id: "exercise.D1_Q1.option.A",
      option: "A",
      text: "매우 좋음",
      candidates: [
        "audio/A_calm_soft_left.mp3",
        "audio/A_calm_soft_right.mp3",
      ],
    }],
  }));
  return {
    rootDirectory,
    selectionsPath: join(rootDirectory, "selections.json"),
  };
}

async function withServer(run) {
  const paths = createFixture();
  const server = createCalmMoodSelectorServer(paths);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`, paths);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("serves only selector assets and byte ranges", async () => {
  await withServer(async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/manifest.json`)).status, 200);
    const partial = await fetch(`${baseUrl}/audio/A_calm_soft_left.mp3`, {
      headers: { Range: "bytes=0-1" },
    });
    assert.equal(partial.status, 206);
    assert.equal(await partial.text(), "le");
    assert.equal((await fetch(`${baseUrl}/selectionStore.mjs`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/../package.json`)).status, 404);
  });
});

test("persists candidate-path selections through local API", async () => {
  await withServer(async (baseUrl, paths) => {
    assert.equal((await (await fetch(`${baseUrl}/api/selections`)).json()).selectedCount, 0);

    const saved = await fetch(`${baseUrl}/api/selections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selections: {
          "exercise.D1_Q1.option.A": "audio/A_calm_soft_right.mp3",
        },
      }),
    });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).selections[0].resultSide, "right");
    assert.equal(JSON.parse(readFileSync(paths.selectionsPath, "utf8")).selectedCount, 1);

    const invalid = await fetch(`${baseUrl}/api/selections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selections: {
          "exercise.D1_Q1.option.A": "audio/not-a-candidate.mp3",
        },
      }),
    });
    assert.equal(invalid.status, 400);
  });
});
