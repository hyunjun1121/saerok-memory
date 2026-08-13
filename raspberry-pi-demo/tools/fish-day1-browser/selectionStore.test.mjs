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

test("builds a canonical selection document from inventory data", () => {
  const result = buildSelectionDocument(
    inventory,
    {
      "day.1.greeting": "left",
      "exercise.D1_Q1.prompt": "right",
    },
    "2026-08-12T00:00:00.000Z",
  );

  assert.deepEqual(result, {
    schemaVersion: 1,
    locale: "ko",
    day: 1,
    entryCount: 2,
    selectedCount: 2,
    complete: true,
    updatedAt: "2026-08-12T00:00:00.000Z",
    selections: [
      {
        index: 1,
        id: "day.1.greeting",
        text: "첫 문장",
        choice: "left",
        audioPath: "audio/01_left.mp3",
      },
      {
        index: 2,
        id: "exercise.D1_Q1.prompt",
        text: "둘째 문장",
        choice: "right",
        audioPath: "audio/02_right.mp3",
      },
    ],
  });
});

test("rejects unknown ids and invalid choices", () => {
  assert.throws(
    () => buildSelectionDocument(inventory, { unknown: "left" }),
    /Unknown narration id: unknown/u,
  );
  assert.throws(
    () => buildSelectionDocument(inventory, { "day.1.greeting": "center" }),
    /Invalid choice for day\.1\.greeting/u,
  );
});

test("saves and reads an incomplete selection document", () => {
  const directory = mkdtempSync(join(tmpdir(), "haru-day1-selections-"));
  const path = join(directory, "selections.json");
  const document = buildSelectionDocument(
    inventory,
    { "exercise.D1_Q1.prompt": "right" },
    "2026-08-12T00:00:00.000Z",
  );

  saveSelectionDocument(path, document);

  assert.deepEqual(readSelectionDocument(path, inventory), document);
  assert.equal(JSON.parse(readFileSync(path, "utf8")).selectedCount, 1);
  assert.equal(document.complete, false);
});

test("missing selection file starts empty", () => {
  const directory = mkdtempSync(join(tmpdir(), "haru-day1-selections-"));
  const path = join(directory, "missing.json");

  assert.deepEqual(readSelectionDocument(path, inventory), {
    schemaVersion: 1,
    locale: "ko",
    day: 1,
    entryCount: 2,
    selectedCount: 0,
    complete: false,
    updatedAt: null,
    selections: [],
  });
});
