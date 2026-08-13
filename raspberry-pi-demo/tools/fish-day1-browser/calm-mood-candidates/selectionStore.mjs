import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const SAFE_AUDIO_PATH = /^audio\/[A-Za-z0-9._-]+\.mp3$/u;

function parseCandidate(path, tags) {
  if (!SAFE_AUDIO_PATH.test(path)) throw new Error(`Unsafe audio path: ${path}`);

  const candidateId = basename(path, ".mp3");
  const resultSide = candidateId.endsWith("_left")
    ? "left"
    : candidateId.endsWith("_right")
      ? "right"
      : null;
  if (!resultSide) throw new Error(`Missing result side: ${path}`);

  const tag = tags.find((candidateTag) => candidateId.includes(`_${candidateTag.id}_${resultSide}`));
  if (!tag) throw new Error(`Unknown manual tag: ${path}`);

  return {
    candidateId,
    audioPath: path,
    tagId: tag.id,
    tagText: tag.text,
    resultSide,
  };
}

export function getManifestOptions(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.locale !== "ko") {
    throw new Error("Unsupported calm mood manifest");
  }
  if (!Array.isArray(manifest.manualTags) || manifest.manualTags.length === 0) {
    throw new Error("Invalid manual tags");
  }
  const tagIds = new Set();
  for (const tag of manifest.manualTags) {
    if (!tag || typeof tag.id !== "string" || typeof tag.text !== "string" || tagIds.has(tag.id)) {
      throw new Error("Invalid manual tag");
    }
    tagIds.add(tag.id);
  }
  if (!Array.isArray(manifest.options) || manifest.options.length === 0) {
    throw new Error("Invalid mood options");
  }

  const optionIds = new Set();
  const candidatePaths = new Set();
  return manifest.options.map((option) => {
    if (!option
      || typeof option.id !== "string"
      || typeof option.option !== "string"
      || typeof option.text !== "string"
      || optionIds.has(option.id)) {
      throw new Error("Invalid mood option");
    }
    optionIds.add(option.id);
    if (!Array.isArray(option.candidates)
      || option.candidates.length !== manifest.candidateCountPerOption) {
      throw new Error(`Invalid candidate count for ${option.id}`);
    }

    const candidates = option.candidates.map((path) => {
      if (candidatePaths.has(path)) throw new Error(`Duplicate candidate path: ${path}`);
      candidatePaths.add(path);
      return parseCandidate(path, manifest.manualTags);
    });

    return { ...option, candidates };
  });
}

export function buildSelectionDocument(manifest, requestedSelections = {}, updatedAt) {
  const options = getManifestOptions(manifest);
  if (!requestedSelections || Array.isArray(requestedSelections) || typeof requestedSelections !== "object") {
    throw new Error("Selections must be an object");
  }

  const optionsById = new Map(options.map((option) => [option.id, option]));
  for (const [id, path] of Object.entries(requestedSelections)) {
    const option = optionsById.get(id);
    if (!option) throw new Error(`Unknown option id: ${id}`);
    if (!option.candidates.some((candidate) => candidate.audioPath === path)) {
      throw new Error(`Invalid candidate for ${id}`);
    }
  }

  const selections = options.flatMap((option) => {
    const audioPath = requestedSelections[option.id];
    const candidate = option.candidates.find((item) => item.audioPath === audioPath);
    if (!candidate) return [];
    return [{
      id: option.id,
      option: option.option,
      text: option.text,
      ...candidate,
    }];
  });

  return {
    schemaVersion: 1,
    locale: "ko",
    day: 1,
    questionId: "D1_Q1",
    optionCount: options.length,
    selectedCount: selections.length,
    complete: selections.length === options.length,
    updatedAt: selections.length === 0 ? (updatedAt ?? null) : (updatedAt ?? new Date().toISOString()),
    selections,
  };
}

export function readSelectionDocument(path, manifest) {
  if (!existsSync(path)) return buildSelectionDocument(manifest, {}, null);

  let stored;
  try {
    stored = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read selections: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!stored || stored.schemaVersion !== 1 || !Array.isArray(stored.selections)) {
    throw new Error("Unsupported calm mood selections file");
  }

  const choices = {};
  for (const selection of stored.selections) {
    if (!selection || typeof selection.id !== "string" || typeof selection.audioPath !== "string") {
      throw new Error("Invalid stored selection");
    }
    choices[selection.id] = selection.audioPath;
  }
  return buildSelectionDocument(manifest, choices, stored.updatedAt ?? null);
}

export function saveSelectionDocument(path, document) {
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, path);
}
