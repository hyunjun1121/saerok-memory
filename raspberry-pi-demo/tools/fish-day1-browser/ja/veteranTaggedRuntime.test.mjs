import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const jaRoot = path.resolve("tools/fish-day1-browser/ja");
const runtimeRoot = path.resolve("public/assets/audio/narration/ja/day1");

async function json(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("Japanese Day 1 and NFC login use the veteran voice and gentle pauses", async () => {
  const inventory = await json(path.join(jaRoot, "day1-inventory.json"));
  const selections = await json(path.join(jaRoot, "day1-selections.json"));
  const runtimeManifest = await json(path.join(runtimeRoot, "manifest.json"));

  assert.equal(inventory.selectedVoiceId, "veteran");
  assert.equal(inventory.selectedTagStyle, "gentle_double_pause");
  assert.equal(inventory.entries.length, 31);
  assert.equal(selections.complete, true);
  assert.equal(selections.selectedCount, 31);
  assert.ok(selections.selections.every((selection) => selection.voiceId === "veteran"));
  assert.equal(runtimeManifest.selectionCount, 32);

  const hometownOption = inventory.entries.find((entry) => entry.id === "exercise.D1_Q3.option.A");
  assert.equal(hometownOption?.text, "長野県松本市");
  assert.equal(hometownOption?.taggedText, "[short pause]ながのけん・まつもとし[short pause]");

  for (const entry of inventory.entries) {
    assert.equal((entry.taggedText.match(/\[short pause\]/gu) ?? []).length, 2, entry.id);
    const candidate = entry.candidates.find((item) => item.voiceId === "veteran");
    assert.equal(candidate?.status, "ready", entry.id);
    await access(path.join(jaRoot, candidate.targetPath));
    const base = candidate.targetPath.replace(/^audio\//u, "").replace(/\.mp3$/u, "");
    await access(path.join(jaRoot, "audio/raw", `${base}_double_pause_take1.mp3`));
    await access(path.join(jaRoot, "audio/raw", `${base}_double_pause_take2.mp3`));
    await access(path.join(runtimeRoot, `${String(entry.index).padStart(2, "0")}_${entry.slug}.mp3`));
  }

  const nfc = runtimeManifest.entries.find((entry) => entry.id === "login.nfc.waiting");
  assert.ok(nfc, "missing Japanese NFC login narration");
  assert.equal(nfc.voiceId, "veteran");
  assert.equal(nfc.tagStyle, "gentle_double_pause");
  assert.equal(nfc.taggedText, "カードリーダーに[short pause]カードを[short pause]かざしてください。");
  assert.equal(nfc.sourcePath, "audio/32_login_nfc_waiting_veteran.mp3");
  await access(path.join(runtimeRoot, "32_login_nfc_waiting.mp3"));
});
