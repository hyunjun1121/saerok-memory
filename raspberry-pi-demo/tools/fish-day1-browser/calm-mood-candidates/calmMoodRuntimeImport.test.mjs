import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyCalmMoodRuntimeOverrides,
  buildCalmMoodRuntimePlan,
} from "./calmMoodRuntimeImport.mjs";

const calmManifest = JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));
const selections = JSON.parse(readFileSync(new URL("./selections.json", import.meta.url), "utf8"));

const EXPECTED = [
  {
    id: "exercise.D1_Q1.option.A",
    text: "매우 좋음",
    option: "A",
    candidateId: "A_very_good_calm_soft_left",
    sourcePath: "audio/A_very_good_calm_soft_left.mp3",
    tagId: "calm_soft",
    tagText: "차분하고 부드럽게",
    resultSide: "left",
    previousPath: "assets/audio/narration/ko/037ca80d4e0c36b5dd5a0b71.ogg",
    previousSha256: "037ca80d4e0c36b5dd5a0b71db4516933aa900813dd9ca911cd9903adf71de12",
  },
  {
    id: "exercise.D1_Q1.option.B",
    text: "좋음",
    option: "B",
    candidateId: "B_good_calm_soft_left",
    sourcePath: "audio/B_good_calm_soft_left.mp3",
    tagId: "calm_soft",
    tagText: "차분하고 부드럽게",
    resultSide: "left",
    previousPath: "assets/audio/narration/ko/d49c378c32d7b41d58bec8f2.ogg",
    previousSha256: "d49c378c32d7b41d58bec8f2f3608817ee364b90512f3f40038c88767a84fd87",
  },
  {
    id: "exercise.D1_Q1.option.C",
    text: "그저 그럼",
    option: "C",
    candidateId: "C_so_so_relaxed_clear_left",
    sourcePath: "audio/C_so_so_relaxed_clear_left.mp3",
    tagId: "relaxed_clear",
    tagText: "편안하고 또렷하게",
    resultSide: "left",
    previousPath: "assets/audio/narration/ko/06b9260222301a4091b82589.ogg",
    previousSha256: "06b9260222301a4091b82589c529c59b93325a490c8eddfb966841d695a7c688",
  },
  {
    id: "exercise.D1_Q1.option.D",
    text: "좋지 않음",
    option: "D",
    candidateId: "D_not_good_relaxed_clear_left",
    sourcePath: "audio/D_not_good_relaxed_clear_left.mp3",
    tagId: "relaxed_clear",
    tagText: "편안하고 또렷하게",
    resultSide: "left",
    previousPath: "assets/audio/narration/ko/4fe2fa834c4bde13ef8286ee.ogg",
    previousSha256: "4fe2fa834c4bde13ef8286ee3887b2f49820ec00f6f399af5935f770eca0ea63",
  },
];

function narrationSource() {
  return {
    schemaVersion: 1,
    entries: [
      ...EXPECTED.map(({ id, text }) => ({ id, locale: "ko", text })),
      { id: "day.1.greeting", locale: "ko", text: "인사" },
    ],
  };
}

function runtimeManifest() {
  return {
    schemaVersion: 1,
    sourceSha256: "f".repeat(64),
    model: {
      id: "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
      revision: "revision",
      license: "Apache-2.0",
      sourceUrl: "https://example.com/qwen",
    },
    audio: {
      codec: "opus",
      container: "ogg",
      channels: 1,
      loudnessTargetLufs: -16,
      truePeakDbtp: -1,
    },
    audioOverrides: {
      schemaVersion: 1,
      locale: "ko",
      day: 1,
      provider: "Fish Audio",
      selection: "right",
      entryCount: 4,
    },
    entries: [
      ...EXPECTED.map((entry, index) => ({
        id: entry.id,
        locale: "ko",
        text: entry.text,
        path: entry.previousPath,
        audioPath: entry.previousPath,
        sha256: entry.previousSha256,
        durationMs: 1_000 + index,
        origin: {
          type: "user-selected-browser-export",
          provider: "Fish Audio",
          choice: "right",
          sourcePath: `tools/fish-day1-browser/audio/0${index + 3}_old_right.mp3`,
          sourceSha256: String(index + 1).repeat(64),
        },
      })),
      {
        id: "day.1.greeting",
        locale: "ko",
        text: "인사",
        path: "assets/audio/narration/ko/unchanged.ogg",
        audioPath: "assets/audio/narration/ko/unchanged.ogg",
        sha256: "e".repeat(64),
        durationMs: 900,
      },
      {
        id: "exercise.D1_Q1.option.A",
        locale: "ja",
        text: "とても良い",
        path: "assets/audio/narration/ja/unchanged.ogg",
        audioPath: "assets/audio/narration/ja/unchanged.ogg",
        sha256: "d".repeat(64),
        durationMs: 800,
      },
    ],
  };
}

test("builds the exact complete A-D calm runtime plan over the prior B assets", () => {
  const plan = buildCalmMoodRuntimePlan(
    calmManifest,
    selections,
    narrationSource(),
    runtimeManifest(),
  );

  assert.deepEqual(plan, EXPECTED);
});

test("rejects incomplete, duplicate, cross-option, and text-drifted selections", () => {
  const incomplete = structuredClone(selections);
  incomplete.complete = false;
  incomplete.selectedCount = 3;
  incomplete.selections.pop();
  assert.throws(
    () => buildCalmMoodRuntimePlan(calmManifest, incomplete, narrationSource(), runtimeManifest()),
    /complete 4-option selection/u,
  );

  const duplicate = structuredClone(selections);
  duplicate.selections[3] = structuredClone(duplicate.selections[0]);
  assert.throws(
    () => buildCalmMoodRuntimePlan(calmManifest, duplicate, narrationSource(), runtimeManifest()),
    /duplicate calm mood selection/iu,
  );

  const crossOption = structuredClone(selections);
  crossOption.selections[0].audioPath = selections.selections[1].audioPath;
  assert.throws(
    () => buildCalmMoodRuntimePlan(calmManifest, crossOption, narrationSource(), runtimeManifest()),
    /invalid calm mood candidate/iu,
  );

  const driftedSource = narrationSource();
  driftedSource.entries[0].text = "달라진 문구";
  assert.throws(
    () => buildCalmMoodRuntimePlan(calmManifest, selections, driftedSource, runtimeManifest()),
    /narration source text mismatch/iu,
  );
});

test("replaces only the four Korean options and records calm candidate provenance", () => {
  const sourceManifest = runtimeManifest();
  const plan = buildCalmMoodRuntimePlan(
    calmManifest,
    selections,
    narrationSource(),
    sourceManifest,
  );
  const imported = plan.map((entry, index) => {
    const sha256 = ["a", "b", "c", "d"][index].repeat(64);
    return {
      id: entry.id,
      sourcePath: entry.sourcePath,
      sourceSha256: ["1", "2", "3", "4"][index].repeat(64),
      path: `assets/audio/narration/ko/${sha256.slice(0, 24)}.ogg`,
      sha256,
      durationMs: 1_500 + index,
    };
  });

  const result = applyCalmMoodRuntimeOverrides(
    sourceManifest,
    plan,
    imported,
    "2026-08-13T00:00:00.000Z",
  );

  assert.equal(result.audioOverrides.selection, "mixed");
  assert.equal(result.audioOverrides.entryCount, 4);
  assert.equal(result.audioOverrides.appliedAt, "2026-08-13T00:00:00.000Z");
  for (const [index, expected] of EXPECTED.entries()) {
    const entry = result.entries.find((candidate) => (
      candidate.locale === "ko" && candidate.id === expected.id
    ));
    assert.deepEqual(entry, {
      id: expected.id,
      locale: "ko",
      text: expected.text,
      path: imported[index].path,
      audioPath: imported[index].path,
      sha256: imported[index].sha256,
      durationMs: imported[index].durationMs,
      origin: {
        type: "user-selected-browser-export",
        provider: "Fish Audio",
        choice: expected.resultSide,
        sourcePath: `tools/fish-day1-browser/calm-mood-candidates/${expected.sourcePath}`,
        sourceSha256: imported[index].sourceSha256,
        candidateId: expected.candidateId,
        tagId: expected.tagId,
        tagText: expected.tagText,
      },
    });
  }

  assert.deepEqual(
    result.entries.find((entry) => entry.id === "day.1.greeting" && entry.locale === "ko"),
    sourceManifest.entries.find((entry) => entry.id === "day.1.greeting" && entry.locale === "ko"),
  );
  assert.deepEqual(
    result.entries.find((entry) => entry.id === "exercise.D1_Q1.option.A" && entry.locale === "ja"),
    sourceManifest.entries.find((entry) => entry.id === "exercise.D1_Q1.option.A" && entry.locale === "ja"),
  );
});
