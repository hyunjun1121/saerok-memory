import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRuntimeOverrides,
  buildAllRightSelectionDocument,
  buildRuntimeImportPlan,
} from "./day1RuntimeImport.mjs";

const inventory = {
  schemaVersion: 1,
  locale: "ko",
  entryCount: 2,
  entries: [
    {
      index: 1,
      id: "day.1.greeting",
      text: "첫 문장",
      leftTargetPath: "audio/01_left.mp3",
      rightTargetPath: "audio/01_right.mp3",
    },
    {
      index: 2,
      id: "exercise.D1_Q1.prompt",
      text: "둘째 문장",
      leftTargetPath: "audio/02_left.mp3",
      rightTargetPath: "audio/02_right.mp3",
    },
  ],
};

const source = {
  schemaVersion: 1,
  entries: [
    { id: "day.1.greeting", locale: "ko", text: "첫 문장" },
    { id: "exercise.D1_Q1.prompt", locale: "ko", text: "둘째 문장" },
    { id: "guide.choice", locale: "ko", text: "고르세요" },
  ],
};

const manifest = {
  schemaVersion: 1,
  sourceSha256: "a".repeat(64),
  model: {
    id: "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
    revision: "revision",
    license: "Apache-2.0",
    sourceUrl: "https://example.com/model",
  },
  audio: {
    codec: "opus",
    container: "ogg",
    channels: 1,
    loudnessTargetLufs: -16,
    truePeakDbtp: -1,
  },
  entries: [
    {
      id: "day.1.greeting",
      locale: "ko",
      text: "첫 문장",
      path: "assets/audio/narration/ko/old-one.ogg",
      audioPath: "assets/audio/narration/ko/old-one.ogg",
      sha256: "1".repeat(64),
      durationMs: 1000,
    },
    {
      id: "exercise.D1_Q1.prompt",
      locale: "ko",
      text: "둘째 문장",
      path: "assets/audio/narration/ko/old-two.ogg",
      audioPath: "assets/audio/narration/ko/old-two.ogg",
      sha256: "2".repeat(64),
      durationMs: 1200,
    },
    {
      id: "guide.choice",
      locale: "ko",
      text: "고르세요",
      path: "assets/audio/narration/ko/unchanged.ogg",
      audioPath: "assets/audio/narration/ko/unchanged.ogg",
      sha256: "3".repeat(64),
      durationMs: 800,
    },
  ],
};

test("builds a complete all-B selection document", () => {
  const result = buildAllRightSelectionDocument(inventory, "2026-08-12T02:00:00.000Z");

  assert.equal(result.selectedCount, 2);
  assert.equal(result.complete, true);
  assert.deepEqual(result.selections.map(({ choice, audioPath }) => ({ choice, audioPath })), [
    { choice: "right", audioPath: "audio/01_right.mp3" },
    { choice: "right", audioPath: "audio/02_right.mp3" },
  ]);
});

test("refuses incomplete or non-B selections", () => {
  const complete = buildAllRightSelectionDocument(inventory, "2026-08-12T02:00:00.000Z");

  assert.throws(
    () => buildRuntimeImportPlan(inventory, { ...complete, complete: false }, source, manifest),
    /complete 2-entry selection/u,
  );
  assert.throws(
    () => buildRuntimeImportPlan(
      inventory,
      { ...complete, selections: [{ ...complete.selections[0], choice: "left" }, complete.selections[1]] },
      source,
      manifest,
    ),
    /must use B\/right/u,
  );
});

test("refuses text drift between inventory, source, and manifest", () => {
  const selections = buildAllRightSelectionDocument(inventory, "2026-08-12T02:00:00.000Z");
  const driftedSource = structuredClone(source);
  driftedSource.entries[0].text = "바뀐 문장";

  assert.throws(
    () => buildRuntimeImportPlan(inventory, selections, driftedSource, manifest),
    /Narration source text mismatch: ko:day\.1\.greeting/u,
  );
});

test("replaces only selected Korean entries and records B provenance", () => {
  const selections = buildAllRightSelectionDocument(inventory, "2026-08-12T02:00:00.000Z");
  const plan = buildRuntimeImportPlan(inventory, selections, source, manifest);
  const imported = [
    {
      id: "day.1.greeting",
      sourcePath: "audio/01_right.mp3",
      sourceSha256: "4".repeat(64),
      path: "assets/audio/narration/ko/555555555555555555555555.ogg",
      sha256: "5".repeat(64),
      durationMs: 1500,
    },
    {
      id: "exercise.D1_Q1.prompt",
      sourcePath: "audio/02_right.mp3",
      sourceSha256: "6".repeat(64),
      path: "assets/audio/narration/ko/777777777777777777777777.ogg",
      sha256: "7".repeat(64),
      durationMs: 1700,
    },
  ];

  const result = applyRuntimeOverrides(manifest, plan, imported);

  assert.equal(result.entries.length, 3);
  assert.equal(result.entries[2].path, "assets/audio/narration/ko/unchanged.ogg");
  assert.deepEqual(result.entries[0], {
    id: "day.1.greeting",
    locale: "ko",
    text: "첫 문장",
    path: "assets/audio/narration/ko/555555555555555555555555.ogg",
    audioPath: "assets/audio/narration/ko/555555555555555555555555.ogg",
    sha256: "5".repeat(64),
    durationMs: 1500,
    origin: {
      type: "user-selected-browser-export",
      provider: "Fish Audio",
      choice: "right",
      sourcePath: "tools/fish-day1-browser/audio/01_right.mp3",
      sourceSha256: "4".repeat(64),
    },
  });
});
