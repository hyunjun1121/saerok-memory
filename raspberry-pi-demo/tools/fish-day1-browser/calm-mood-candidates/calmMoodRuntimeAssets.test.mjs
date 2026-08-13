import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const calmRoot = path.resolve("tools/fish-day1-browser/calm-mood-candidates");
const day1Root = path.resolve("tools/fish-day1-browser");
const demoRoot = path.resolve(".");

const EXPECTED_SOURCE_SHA256 = new Map([
  ["exercise.D1_Q1.option.A", "8142fbe2876ebc608b3472d4aca68a20c7a8e8d37a5d576b74a8be93c74440a2"],
  ["exercise.D1_Q1.option.B", "4751dabfd409bfdeaa23e42efd41707fecf2d7722fa6027bebe672a0956ad2cf"],
  ["exercise.D1_Q1.option.C", "a8147002c9572410ca3fb89b7c9b1da31b498edf50419f471f3d35ed4b77dc8e"],
  ["exercise.D1_Q1.option.D", "3c4724141be63c177962245662ae87954075603b14c181639cf2387953e82557"],
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("production runtime uses the four selected calm mood assets and no replaced B path", async () => {
  const selections = await readJson(path.join(calmRoot, "selections.json"));
  const audit = await readJson(path.join(calmRoot, "calm-mood-runtime-import.json"));
  const baseAudit = await readJson(path.join(day1Root, "day1-runtime-import.json"));
  const manifest = await readJson(path.join(
    demoRoot,
    "public/assets/audio/narration/manifest.json",
  ));

  assert.equal(selections.complete, true);
  assert.equal(selections.selectedCount, 4);
  assert.equal(audit.entryCount, 4);
  assert.equal(audit.questionId, "D1_Q1");
  assert.deepEqual(
    audit.entries.map((entry) => entry.id),
    selections.selections.map((selection) => selection.id),
  );

  const baseById = new Map(baseAudit.entries.map((entry) => [entry.id, entry]));
  const auditById = new Map(audit.entries.map((entry) => [entry.id, entry]));
  const selectedIds = new Set(selections.selections.map((selection) => selection.id));
  const allManifestPaths = new Set(manifest.entries.map((entry) => entry.path));

  for (const selection of selections.selections) {
    const auditEntry = auditById.get(selection.id);
    const baseEntry = baseById.get(selection.id);
    const runtimeEntry = manifest.entries.find((entry) => (
      entry.locale === "ko" && entry.id === selection.id
    ));
    assert.ok(auditEntry, `missing calm audit entry: ${selection.id}`);
    assert.ok(baseEntry, `missing prior B audit entry: ${selection.id}`);
    assert.ok(runtimeEntry, `missing runtime entry: ${selection.id}`);

    assert.equal(auditEntry.sourcePath, selection.audioPath);
    assert.equal(auditEntry.previousPath, baseEntry.path);
    assert.equal(auditEntry.previousSha256, baseEntry.sha256);
    assert.notEqual(auditEntry.path, auditEntry.previousPath);
    assert.equal(runtimeEntry.path, auditEntry.path);
    assert.equal(runtimeEntry.sha256, auditEntry.sha256);
    assert.equal(runtimeEntry.text, selection.text);
    assert.deepEqual(runtimeEntry.origin, {
      type: "user-selected-browser-export",
      provider: "Fish Audio",
      choice: selection.resultSide,
      sourcePath: `tools/fish-day1-browser/calm-mood-candidates/${selection.audioPath}`,
      sourceSha256: auditEntry.sourceSha256,
      candidateId: selection.candidateId,
      tagId: selection.tagId,
      tagText: selection.tagText,
    });

    const sourceBytes = await readFile(path.join(calmRoot, ...selection.audioPath.split("/")));
    const runtimeBytes = await readFile(path.join(demoRoot, "public", ...auditEntry.path.split("/")));
    assert.equal(sha256(sourceBytes), EXPECTED_SOURCE_SHA256.get(selection.id));
    assert.equal(sha256(sourceBytes), auditEntry.sourceSha256);
    assert.equal(sha256(runtimeBytes), auditEntry.sha256);
    assert.ok(runtimeBytes.length > 0);
    assert.equal(allManifestPaths.has(baseEntry.path), false, `replaced B path still referenced: ${baseEntry.path}`);
  }

  const remainingBaseEntries = baseAudit.entries.filter((entry) => !selectedIds.has(entry.id));
  assert.equal(remainingBaseEntries.length, 27);
  for (const baseEntry of remainingBaseEntries) {
    const runtimeEntry = manifest.entries.find((entry) => (
      entry.locale === "ko" && entry.id === baseEntry.id
    ));
    assert.ok(runtimeEntry, `missing untouched Day 1 entry: ${baseEntry.id}`);
    assert.equal(runtimeEntry.path, baseEntry.path, `unexpected replacement: ${baseEntry.id}`);
    assert.equal(runtimeEntry.sha256, baseEntry.sha256, `unexpected hash change: ${baseEntry.id}`);
  }
});
