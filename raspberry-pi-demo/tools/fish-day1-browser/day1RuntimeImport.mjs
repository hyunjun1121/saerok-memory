import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { buildSelectionDocument } from "./selectionStore.mjs";

const execFileAsync = promisify(execFile);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_MP3_PATH = /^audio\/[A-Za-z0-9._-]+\.mp3$/u;
const SAFE_OGG_PATH = /^assets\/audio\/narration\/ko\/[a-f0-9]{24}\.ogg$/u;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireEntries(document, label) {
  if (!document || document.schemaVersion !== 1 || !Array.isArray(document.entries)) {
    throw new Error(`${label} must use schemaVersion 1 with entries`);
  }
  return document.entries;
}

function indexByLocaleAndId(entries, label) {
  const result = new Map();
  for (const entry of entries) {
    const key = `${entry.locale}:${entry.id}`;
    if (result.has(key)) throw new Error(`${label} has duplicate entry: ${key}`);
    result.set(key, entry);
  }
  return result;
}

export function buildAllRightSelectionDocument(inventory, updatedAt = new Date().toISOString()) {
  const entries = requireEntries(inventory, "Day 1 inventory");
  const choices = Object.fromEntries(entries.map((entry) => [entry.id, "right"]));
  return buildSelectionDocument(inventory, choices, updatedAt);
}

export function buildRuntimeImportPlan(inventory, selections, source, manifest) {
  const inventoryEntries = requireEntries(inventory, "Day 1 inventory");
  if (
    !selections ||
    selections.schemaVersion !== 1 ||
    selections.locale !== "ko" ||
    selections.day !== 1 ||
    selections.complete !== true ||
    selections.entryCount !== inventoryEntries.length ||
    selections.selectedCount !== inventoryEntries.length ||
    !Array.isArray(selections.selections) ||
    selections.selections.length !== inventoryEntries.length
  ) {
    throw new Error(`Runtime import requires a complete ${inventoryEntries.length}-entry selection`);
  }

  const sourceByKey = indexByLocaleAndId(requireEntries(source, "Narration source"), "Narration source");
  const manifestByKey = indexByLocaleAndId(requireEntries(manifest, "Narration manifest"), "Narration manifest");
  const selectionsById = new Map();
  for (const selection of selections.selections) {
    if (!selection || typeof selection.id !== "string") {
      throw new Error("Invalid Day 1 selection entry");
    }
    if (selectionsById.has(selection.id)) {
      throw new Error(`Duplicate Day 1 selection: ${selection.id}`);
    }
    selectionsById.set(selection.id, selection);
  }

  return inventoryEntries.map((entry) => {
    const selection = selectionsById.get(entry.id);
    if (!selection) throw new Error(`Missing Day 1 selection: ${entry.id}`);
    if (selection.choice !== "right") throw new Error(`Day 1 selection must use B/right: ${entry.id}`);
    if (selection.index !== entry.index || selection.text !== entry.text) {
      throw new Error(`Selection metadata mismatch: ${entry.id}`);
    }
    if (selection.audioPath !== entry.rightTargetPath || !SAFE_MP3_PATH.test(selection.audioPath)) {
      throw new Error(`Selection audio path mismatch: ${entry.id}`);
    }

    const key = `ko:${entry.id}`;
    const sourceEntry = sourceByKey.get(key);
    if (!sourceEntry || sourceEntry.text !== entry.text) {
      throw new Error(`Narration source text mismatch: ${key}`);
    }
    const manifestEntry = manifestByKey.get(key);
    if (!manifestEntry || manifestEntry.text !== entry.text) {
      throw new Error(`Narration manifest text mismatch: ${key}`);
    }

    return {
      index: entry.index,
      id: entry.id,
      text: entry.text,
      sourcePath: selection.audioPath,
      previousPath: manifestEntry.path,
      previousSha256: manifestEntry.sha256,
    };
  });
}

export function applyRuntimeOverrides(manifest, plan, importedEntries, appliedAt = undefined) {
  if (!Array.isArray(importedEntries) || importedEntries.length !== plan.length) {
    throw new Error(`Imported audio count mismatch: expected ${plan.length}`);
  }
  const planById = new Map(plan.map((entry) => [entry.id, entry]));
  const importedById = new Map();
  for (const entry of importedEntries) {
    if (!planById.has(entry.id)) throw new Error(`Unexpected imported narration: ${entry.id}`);
    if (importedById.has(entry.id)) throw new Error(`Duplicate imported narration: ${entry.id}`);
    if (!SAFE_MP3_PATH.test(entry.sourcePath)) throw new Error(`Unsafe source audio path: ${entry.id}`);
    if (!SAFE_OGG_PATH.test(entry.path)) throw new Error(`Unsafe imported Ogg path: ${entry.id}`);
    if (!SHA256_PATTERN.test(entry.sourceSha256) || !SHA256_PATTERN.test(entry.sha256)) {
      throw new Error(`Invalid imported checksum: ${entry.id}`);
    }
    if (!Number.isFinite(entry.durationMs) || entry.durationMs <= 0) {
      throw new Error(`Invalid imported duration: ${entry.id}`);
    }
    importedById.set(entry.id, entry);
  }

  const replaced = new Set();
  const entries = manifest.entries.map((entry) => {
    if (entry.locale !== "ko" || !planById.has(entry.id)) return entry;
    const planEntry = planById.get(entry.id);
    const imported = importedById.get(entry.id);
    if (!imported) throw new Error(`Missing imported narration: ${entry.id}`);
    if (planEntry.sourcePath !== imported.sourcePath) {
      throw new Error(`Imported source path mismatch: ${entry.id}`);
    }
    replaced.add(entry.id);
    return {
      id: entry.id,
      locale: "ko",
      text: entry.text,
      path: imported.path,
      audioPath: imported.path,
      sha256: imported.sha256,
      durationMs: imported.durationMs,
      origin: {
        type: "user-selected-browser-export",
        provider: "Fish Audio",
        choice: "right",
        sourcePath: `tools/fish-day1-browser/${imported.sourcePath}`,
        sourceSha256: imported.sourceSha256,
      },
    };
  });
  if (replaced.size !== plan.length) {
    throw new Error(`Manifest replacement count mismatch: expected ${plan.length}, received ${replaced.size}`);
  }

  return {
    ...manifest,
    audioOverrides: {
      schemaVersion: 1,
      locale: "ko",
      day: 1,
      provider: "Fish Audio",
      selection: "right",
      entryCount: plan.length,
      ...(appliedAt === undefined ? {} : { appliedAt }),
    },
    entries,
  };
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function transcodeEntry({ demoRoot, toolRoot, workRoot, entry, ffmpeg, ffprobe }) {
  const inputPath = path.join(toolRoot, ...entry.sourcePath.split("/"));
  const sourceBytes = await readFile(inputPath);
  if (sourceBytes.length === 0) throw new Error(`Selected MP3 is empty: ${entry.id}`);

  const temporaryPath = path.join(workRoot, `${String(entry.index).padStart(2, "0")}.ogg`);
  await execFileAsync(ffmpeg, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-af",
    "loudnorm=I=-16:TP=-1:LRA=7",
    "-ac",
    "1",
    "-ar",
    "24000",
    "-c:a",
    "libopus",
    "-b:a",
    "48k",
    "-vbr",
    "on",
    "-compression_level",
    "10",
    temporaryPath,
  ]);

  const outputBytes = await readFile(temporaryPath);
  const outputSha256 = sha256(outputBytes);
  const relativePath = `assets/audio/narration/ko/${outputSha256.slice(0, 24)}.ogg`;
  const finalPath = path.join(demoRoot, "public", ...relativePath.split("/"));
  await mkdir(path.dirname(finalPath), { recursive: true });
  if (await fileExists(finalPath)) {
    const existingSha256 = sha256(await readFile(finalPath));
    if (existingSha256 !== outputSha256) throw new Error(`Content-hash collision: ${relativePath}`);
  } else {
    await copyFile(temporaryPath, finalPath);
  }

  const { stdout } = await execFileAsync(ffprobe, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    finalPath,
  ]);
  const durationMs = Math.round(Number.parseFloat(stdout.trim()) * 1000);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(`Cannot probe imported narration: ${entry.id}`);
  }

  return {
    id: entry.id,
    sourcePath: entry.sourcePath,
    sourceSha256: sha256(sourceBytes),
    path: relativePath,
    sha256: outputSha256,
    durationMs,
  };
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

export async function importAllRightNarration({
  demoRoot,
  toolRoot,
  ffmpeg = "ffmpeg",
  ffprobe = "ffprobe",
  appliedAt = new Date().toISOString(),
}) {
  const inventoryPath = path.join(toolRoot, "day1-inventory.json");
  const selectionsPath = path.join(toolRoot, "day1-selections.json");
  const sourcePath = path.join(demoRoot, "tools", "tts", "narration-source.json");
  const manifestPath = path.join(demoRoot, "public", "assets", "audio", "narration", "manifest.json");
  const modelSourcePath = path.join(demoRoot, "public", "assets", "audio", "narration", "model-source.json");
  const auditPath = path.join(toolRoot, "day1-runtime-import.json");
  const workRoot = path.join(toolRoot, ".work", "day1-right-import");
  await mkdir(workRoot, { recursive: true });

  const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const modelSource = JSON.parse(await readFile(modelSourcePath, "utf8"));
  const selections = buildAllRightSelectionDocument(inventory, appliedAt);
  const plan = buildRuntimeImportPlan(inventory, selections, source, manifest);

  const backupPath = path.join(workRoot, "manifest-before-day1-b.json");
  if (!(await fileExists(backupPath))) await copyFile(manifestPath, backupPath);

  const importedEntries = [];
  for (const entry of plan) {
    importedEntries.push(await transcodeEntry({
      demoRoot,
      toolRoot,
      workRoot,
      entry,
      ffmpeg,
      ffprobe,
    }));
  }
  const updatedManifest = applyRuntimeOverrides(manifest, plan, importedEntries, appliedAt);
  const updatedModelSource = {
    ...modelSource,
    audioOverrides: {
      schemaVersion: 1,
      locale: "ko",
      day: 1,
      entryCount: importedEntries.length,
      provider: "Fish Audio",
      sourceType: "user-selected-browser-export",
      selection: "right",
      model: "not embedded in exported MP3 metadata",
      revision: "not embedded in exported MP3 metadata",
      license: "not embedded in exported MP3 metadata",
      auditPath: "tools/fish-day1-browser/day1-runtime-import.json",
      appliedAt,
    },
  };
  const audit = {
    schemaVersion: 1,
    locale: "ko",
    day: 1,
    choice: "right",
    provider: "Fish Audio",
    entryCount: importedEntries.length,
    appliedAt,
    entries: plan.map((entry) => ({
      ...entry,
      ...importedEntries.find((imported) => imported.id === entry.id),
    })),
  };

  await writeJsonAtomic(selectionsPath, selections);
  await writeJsonAtomic(manifestPath, updatedManifest);
  await writeJsonAtomic(modelSourcePath, updatedModelSource);
  await writeJsonAtomic(auditPath, audit);
  return { selections, manifest: updatedManifest, audit };
}
