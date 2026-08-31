import { existsSync, readFileSync, writeFileSync } from "node:fs";

const SAFE_AUDIO_PATH = /^audio\/[A-Za-z0-9._-]+\.mp3$/u;

function entriesOf(inventory) {
  if (!inventory || inventory.schemaVersion !== 2 || inventory.locale !== "ja") {
    throw new Error("Unsupported Japanese Day 1 inventory");
  }
  if (!Array.isArray(inventory.voiceCandidates) || inventory.voiceCandidates.length !== 3) {
    throw new Error("Japanese inventory must contain three voices");
  }
  const voiceIds = new Set(inventory.voiceCandidates.map((voice) => voice.id));
  if (voiceIds.size !== 3 || [...voiceIds].some((id) => typeof id !== "string")) {
    throw new Error("Invalid Japanese voice candidates");
  }
  if (!Array.isArray(inventory.entries) || inventory.entryCount !== inventory.entries.length) {
    throw new Error("Invalid Japanese Day 1 entries");
  }
  const ids = new Set();
  for (const entry of inventory.entries) {
    if (!entry || !Number.isInteger(entry.index) || typeof entry.id !== "string" || typeof entry.text !== "string") {
      throw new Error("Invalid Japanese Day 1 entry");
    }
    if (ids.has(entry.id)) throw new Error(`Duplicate narration id: ${entry.id}`);
    ids.add(entry.id);
    if (!Array.isArray(entry.candidates) || entry.candidates.length !== 3) {
      throw new Error(`Invalid candidates for ${entry.id}`);
    }
    const candidateIds = new Set();
    for (const candidate of entry.candidates) {
      if (!candidate || !voiceIds.has(candidate.voiceId) || candidateIds.has(candidate.voiceId)) {
        throw new Error(`Invalid voice candidate for ${entry.id}`);
      }
      candidateIds.add(candidate.voiceId);
      if (!SAFE_AUDIO_PATH.test(candidate.targetPath)) {
        throw new Error(`Unsafe audio path for ${entry.id}`);
      }
    }
  }
  return { entries: inventory.entries, voiceIds };
}

export function buildSelectionDocument(inventory, requestedSelections = {}, updatedAt) {
  const { entries, voiceIds } = entriesOf(inventory);
  if (!requestedSelections || Array.isArray(requestedSelections) || typeof requestedSelections !== "object") {
    throw new Error("Selections must be an object");
  }
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  for (const [id, choice] of Object.entries(requestedSelections)) {
    if (!entriesById.has(id)) throw new Error(`Unknown narration id: ${id}`);
    if (!voiceIds.has(choice)) throw new Error(`Invalid voice choice for ${id}`);
  }

  const selections = entries.flatMap((entry) => {
    const choice = requestedSelections[entry.id];
    const candidate = entry.candidates.find((item) => item.voiceId === choice);
    if (!candidate) return [];
    return [{
      index: entry.index,
      id: entry.id,
      text: entry.text,
      voiceId: choice,
      audioPath: candidate.targetPath,
    }];
  });
  const timestamp = selections.length === 0
    ? (updatedAt ?? null)
    : (updatedAt ?? new Date().toISOString());
  return {
    schemaVersion: 1,
    locale: "ja",
    market: "jp",
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
    throw new Error(`Cannot read Japanese selections: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!stored || stored.schemaVersion !== 1 || stored.locale !== "ja" || !Array.isArray(stored.selections)) {
    throw new Error("Unsupported Japanese Day 1 selections file");
  }
  const choices = {};
  for (const selection of stored.selections) {
    if (!selection || typeof selection.id !== "string" || typeof selection.voiceId !== "string") {
      throw new Error("Invalid stored Japanese selection");
    }
    choices[selection.id] = selection.voiceId;
  }
  return buildSelectionDocument(inventory, choices, stored.updatedAt ?? null);
}

export function saveSelectionDocument(path, document) {
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}
