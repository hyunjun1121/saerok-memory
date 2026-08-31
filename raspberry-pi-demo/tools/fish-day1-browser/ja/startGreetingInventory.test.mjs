import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve("tools/fish-day1-browser/ja");

test("Japanese start greeting inventory contains four tag styles and three voices", async () => {
  const inventory = JSON.parse(await readFile(path.join(root, "start-greeting-inventory.json"), "utf8"));
  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.locale, "ja");
  assert.equal(inventory.variants.length, 4);
  assert.equal(inventory.voiceCandidates.length, 3);

  const voiceIds = new Set(inventory.voiceCandidates.map((voice) => voice.id));
  for (const variant of inventory.variants) {
    assert.equal(variant.candidates.length, 3);
    assert.equal(new Set(variant.candidates.map((candidate) => candidate.voiceId)).size, 3);
    for (const candidate of variant.candidates) {
      assert.ok(voiceIds.has(candidate.voiceId));
      assert.match(candidate.targetPath, /^audio\/[A-Za-z0-9._-]+\.mp3$/u);
      if (candidate.status === "ready") {
        await access(path.join(root, candidate.targetPath));
      }
    }
  }
});
