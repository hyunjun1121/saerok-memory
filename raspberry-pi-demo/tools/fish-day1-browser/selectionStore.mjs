import { existsSync, readFileSync, writeFileSync } from "node:fs";

const VALID_CHOICES = new Set(["left", "right"]);
const SAFE_AUDIO_PATH = /^audio\/[A-Za-z0-9._-]+\.mp3$/u;

function getInventoryEntries(inventory) {
  if (!inventory || inventory.schemaVersion !== 1 || inventory.locale !== "ko") {
    throw new Error("Unsupported Day 1 inventory");
  }
  if (!Array.isArray(inventory.entries) || inventory.entryCount !== inventory.entries.length) {
    throw new Error("Invalid Day 1 inventory entries");
  }

  const ids = new Set();
  for (const entry of inventory.entries) {
    if (!entry || !Number.isInteger(entry.index) || typeof entry.id !== "string" || typeof entry.text !== "string") {
      throw new Error("Invalid Day 1 inventory entry");
    }
    if (ids.has(entry.id)) throw new Error(`Duplicate narration id: ${entry.id}`);
    ids.add(entry.id);
    if (!SAFE_AUDIO_PATH.test(entry.leftTargetPath) || !SAFE_AUDIO_PATH.test(entry.rightTargetPath)) {
      throw new Error(`Unsafe audio path for ${entry.id}`);
    }
  }

  return inventory.entries;
}

export function buildSelectionDocument(inventory, requestedSelections = {}, updatedAt) {
  const entries = getInventoryEntries(inventory);
  if (!requestedSelections || Array.isArray(requestedSelections) || typeof requestedSelections !== "object") {
    throw new Error("Selections must be an object");
  }

  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  for (const [id, choice] of Object.entries(requestedSelections)) {
    if (!entriesById.has(id)) throw new Error(`Unknown narration id: ${id}`);
    if (!VALID_CHOICES.has(choice)) throw new Error(`Invalid choice for ${id}`);
  }

  const selections = entries.flatMap((entry) => {
    const choice = requestedSelections[entry.id];
    if (!VALID_CHOICES.has(choice)) return [];
    return [{
      index: entry.index,
      id: entry.id,
      text: entry.text,
      choice,
      audioPath: choice === "left" ? entry.leftTargetPath : entry.rightTargetPath,
    }];
  });

  const timestamp = selections.length === 0
    ? (updatedAt ?? null)
    : (updatedAt ?? new Date().toISOString());

  return {
    schemaVersion: 1,
    locale: "ko",
    day: 1,
    entryCount: entries.length,
    selectedCount: selections.length,
    complete: selections.length === entries.length,
    updatedAt: timestamp,
    selections,
  };
}

export function readSelectionDocument(path, inventory) {
  if (!existsSync(path)) return buildSelectionDocument(inventory, {}, null);

  let stored;
  try {
    stored = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read selections: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!stored || stored.schemaVersion !== 1 || !Array.isArray(stored.selections)) {
    throw new Error("Unsupported Day 1 selections file");
  }

  const choices = {};
  for (const selection of stored.selections) {
    if (!selection || typeof selection.id !== "string") throw new Error("Invalid stored selection");
    choices[selection.id] = selection.choice;
  }
  return buildSelectionDocument(inventory, choices, stored.updatedAt ?? null);
}

export function saveSelectionDocument(path, document) {
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}
