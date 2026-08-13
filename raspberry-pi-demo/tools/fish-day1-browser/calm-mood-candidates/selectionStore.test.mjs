import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildSelectionDocument,
  readSelectionDocument,
  saveSelectionDocument,
} from "./selectionStore.mjs";

const manifest = {
  schemaVersion: 1,
  locale: "ko",
  candidateCountPerOption: 2,
  manualTags: [
    { id: "calm_soft", text: "차분하고 부드럽게" },
  ],
  options: [
    {
      id: "exercise.D1_Q1.option.A",
      option: "A",
      text: "매우 좋음",
      candidates: [
        "audio/A_calm_soft_left.mp3",
        "audio/A_calm_soft_right.mp3",
      ],
    },
    {
      id: "exercise.D1_Q1.option.B",
      option: "B",
      text: "좋음",
      candidates: [
        "audio/B_calm_soft_left.mp3",
        "audio/B_calm_soft_right.mp3",
      ],
    },
  ],
};

test("builds canonical selections in manifest order", () => {
  const document = buildSelectionDocument(
    manifest,
    {
      "exercise.D1_Q1.option.A": "audio/A_calm_soft_right.mp3",
      "exercise.D1_Q1.option.B": "audio/B_calm_soft_left.mp3",
    },
    "2026-08-12T04:30:00.000Z",
  );

  assert.deepEqual(document, {
    schemaVersion: 1,
    locale: "ko",
    day: 1,
    questionId: "D1_Q1",
    optionCount: 2,
    selectedCount: 2,
    complete: true,
    updatedAt: "2026-08-12T04:30:00.000Z",
    selections: [
      {
        id: "exercise.D1_Q1.option.A",
        option: "A",
        text: "매우 좋음",
        candidateId: "A_calm_soft_right",
        audioPath: "audio/A_calm_soft_right.mp3",
        tagId: "calm_soft",
        tagText: "차분하고 부드럽게",
        resultSide: "right",
      },
      {
        id: "exercise.D1_Q1.option.B",
        option: "B",
        text: "좋음",
        candidateId: "B_calm_soft_left",
        audioPath: "audio/B_calm_soft_left.mp3",
        tagId: "calm_soft",
        tagText: "차분하고 부드럽게",
        resultSide: "left",
      },
    ],
  });
});

test("rejects unknown option ids and candidate paths", () => {
  assert.throws(
    () => buildSelectionDocument(manifest, { unknown: "audio/A_calm_soft_left.mp3" }),
    /Unknown option id: unknown/u,
  );
  assert.throws(
    () => buildSelectionDocument(manifest, {
      "exercise.D1_Q1.option.A": "audio/B_calm_soft_left.mp3",
    }),
    /Invalid candidate for exercise\.D1_Q1\.option\.A/u,
  );
});

test("persists and restores an incomplete selection", () => {
  const directory = mkdtempSync(join(tmpdir(), "haru-calm-tts-selection-"));
  const path = join(directory, "selections.json");
  const document = buildSelectionDocument(
    manifest,
    { "exercise.D1_Q1.option.A": "audio/A_calm_soft_left.mp3" },
    "2026-08-12T04:31:00.000Z",
  );

  saveSelectionDocument(path, document);

  assert.deepEqual(readSelectionDocument(path, manifest), document);
  assert.equal(JSON.parse(readFileSync(path, "utf8")).selectedCount, 1);
});

test("missing selection file starts empty", () => {
  const directory = mkdtempSync(join(tmpdir(), "haru-calm-tts-selection-"));
  const path = join(directory, "missing.json");

  assert.deepEqual(readSelectionDocument(path, manifest), {
    schemaVersion: 1,
    locale: "ko",
    day: 1,
    questionId: "D1_Q1",
    optionCount: 2,
    selectedCount: 0,
    complete: false,
    updatedAt: null,
    selections: [],
  });
});
