import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const toolRoot = path.resolve("tools/fish-day1-browser");
const demoRoot = path.resolve(".");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("production Day 1 runtime uses 27 B assets plus four calm selections and the NFC login clip", async () => {
  const inventory = await readJson(path.join(toolRoot, "day1-inventory.json"));
  const selections = await readJson(path.join(toolRoot, "day1-selections.json"));
  const audit = await readJson(path.join(toolRoot, "day1-runtime-import.json"));
  const calmRoot = path.join(toolRoot, "calm-mood-candidates");
  const calmSelections = await readJson(path.join(calmRoot, "selections.json"));
  const calmAudit = await readJson(path.join(calmRoot, "calm-mood-runtime-import.json"));
  const manifest = await readJson(path.join(
    demoRoot,
    "public/assets/audio/narration/manifest.json",
  ));
  const modelSource = await readJson(path.join(
    demoRoot,
    "public/assets/audio/narration/model-source.json",
  ));

  assert.equal(inventory.entryCount, 31);
  assert.equal(selections.entryCount, 31);
  assert.equal(selections.selectedCount, 31);
  assert.equal(selections.complete, true);
  assert.equal(selections.selections.every((entry) => entry.choice === "right"), true);
  assert.equal(audit.choice, "right");
  assert.equal(audit.entryCount, 31);
  assert.equal(manifest.audioOverrides.entryCount, 32);
  assert.equal(manifest.audioOverrides.selection, "mixed");
  assert.equal(manifest.audioOverrides.baseRightEntryCount, 28);
  assert.equal(manifest.audioOverrides.maintainerSelectedEntryCount, 4);
  assert.equal(modelSource.audioOverrides.entryCount, 32);
  assert.equal(modelSource.audioOverrides.selection, "mixed");
  assert.equal(modelSource.audioOverrides.model, "not embedded in exported MP3 metadata");

  const ids = new Set(inventory.entries.map((entry) => entry.id));
  const selectionById = new Map(selections.selections.map((entry) => [entry.id, entry]));
  const auditById = new Map(audit.entries.map((entry) => [entry.id, entry]));
  const calmSelectionById = new Map(calmSelections.selections.map((entry) => [entry.id, entry]));
  const calmAuditById = new Map(calmAudit.entries.map((entry) => [entry.id, entry]));
  const runtimeEntries = manifest.entries.filter((entry) => entry.locale === "ko" && ids.has(entry.id));
  assert.equal(runtimeEntries.length, 31);
  assert.equal(new Set(runtimeEntries.map((entry) => entry.path)).size, 31);

  const otherRuntimePaths = new Set(
    manifest.entries
      .filter((entry) => entry.locale !== "ko" || !ids.has(entry.id))
      .map((entry) => entry.path),
  );
  assert.deepEqual(runtimeEntries.filter((entry) => otherRuntimePaths.has(entry.path)), []);

  const referencedOgg = new Set(manifest.entries.map((entry) => entry.path));
  const shippedOgg = new Set();
  for (const locale of ["ko", "ja"]) {
    const localeDirectory = path.join(demoRoot, "public/assets/audio/narration", locale);
    for (const file of await readdir(localeDirectory)) {
      if (file.endsWith(".ogg")) shippedOgg.add(`assets/audio/narration/${locale}/${file}`);
    }
  }
  assert.deepEqual(
    [...shippedOgg].filter((file) => !referencedOgg.has(file)),
    [],
    "public narration must not ship orphan Ogg files",
  );

  for (const inventoryEntry of inventory.entries) {
    const selection = selectionById.get(inventoryEntry.id);
    const auditEntry = auditById.get(inventoryEntry.id);
    const manifestEntry = runtimeEntries.find((entry) => entry.id === inventoryEntry.id);
    assert.ok(selection, `missing selection ${inventoryEntry.id}`);
    assert.ok(auditEntry, `missing audit ${inventoryEntry.id}`);
    assert.ok(manifestEntry, `missing manifest ${inventoryEntry.id}`);
    assert.equal(manifestEntry.text, inventoryEntry.text);
    const calmSelection = calmSelectionById.get(inventoryEntry.id);
    const expectedAudit = calmSelection ? calmAuditById.get(inventoryEntry.id) : auditEntry;
    assert.ok(expectedAudit, `missing final audit ${inventoryEntry.id}`);
    assert.equal(manifestEntry.path, expectedAudit.path);
    assert.equal(manifestEntry.sha256, expectedAudit.sha256);
    const sourceRelativePath = calmSelection?.audioPath ?? inventoryEntry.rightTargetPath;
    const sourceRoot = calmSelection ? calmRoot : toolRoot;
    const expectedSourcePath = calmSelection
      ? `tools/fish-day1-browser/calm-mood-candidates/${sourceRelativePath}`
      : `tools/fish-day1-browser/${sourceRelativePath}`;
    assert.equal(manifestEntry.origin.choice, calmSelection?.resultSide ?? "right");
    assert.equal(manifestEntry.origin.sourcePath, expectedSourcePath);

    const sourceBytes = await readFile(path.join(sourceRoot, ...sourceRelativePath.split("/")));
    const runtimeBytes = await readFile(path.join(demoRoot, "public", ...manifestEntry.path.split("/")));
    assert.equal(sha256(sourceBytes), expectedAudit.sourceSha256);
    assert.equal(sha256(sourceBytes), manifestEntry.origin.sourceSha256);
    assert.equal(sha256(runtimeBytes), manifestEntry.sha256);
    assert.ok(runtimeBytes.length > 0);
  }

  const nfcEntry = manifest.entries.find(
    (entry) => entry.locale === "ko" && entry.id === "login.nfc.waiting",
  );
  assert.ok(nfcEntry, "missing Korean NFC login narration");
  assert.equal(nfcEntry.text, "카드 리더기에 카드를 대주세요.");
  assert.equal(nfcEntry.origin?.choice, "right");
  assert.equal(nfcEntry.origin?.sourcePath, "tools/fish-day1-browser/audio/32_login_nfc_waiting_right.mp3");
  const nfcSource = await readFile(path.join(demoRoot, nfcEntry.origin.sourcePath));
  const nfcRuntime = await readFile(path.join(demoRoot, "public", ...nfcEntry.path.split("/")));
  assert.equal(sha256(nfcSource), nfcEntry.origin.sourceSha256);
  assert.equal(sha256(nfcRuntime), nfcEntry.sha256);
});
