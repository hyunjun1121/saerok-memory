import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, copyFile, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { getManifestOptions } from "./selectionStore.mjs";

const execFileAsync = promisify(execFile);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_SOURCE_PATH = /^audio\/[A-D]_[A-Za-z0-9_]+_(?:left|right)\.mp3$/u;
const SAFE_OGG_PATH = /^assets\/audio\/narration\/ko\/[a-f0-9]{24}\.ogg$/u;
const REQUIRED_IDS = [
  "exercise.D1_Q1.option.A",
  "exercise.D1_Q1.option.B",
  "exercise.D1_Q1.option.C",
  "exercise.D1_Q1.option.D",
];

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

export function buildCalmMoodRuntimePlan(calmManifest, selections, source, manifest) {
  const options = getManifestOptions(calmManifest);
  if (
    options.length !== REQUIRED_IDS.length ||
    options.some((option, index) => option.id !== REQUIRED_IDS[index])
  ) {
    throw new Error("Calm mood manifest must contain the canonical four Day 1 options");
  }
  if (
    !selections ||
    selections.schemaVersion !== 1 ||
    selections.locale !== "ko" ||
    selections.day !== 1 ||
    selections.questionId !== "D1_Q1" ||
    selections.complete !== true ||
    selections.optionCount !== options.length ||
    selections.selectedCount !== options.length ||
    !Array.isArray(selections.selections) ||
    selections.selections.length !== options.length
  ) {
    throw new Error(`Runtime import requires a complete ${options.length}-option selection`);
  }

  const selectionById = new Map();
  for (const selection of selections.selections) {
    if (!selection || typeof selection.id !== "string") throw new Error("Invalid calm mood selection");
    if (selectionById.has(selection.id)) {
      throw new Error(`Duplicate calm mood selection: ${selection.id}`);
    }
    selectionById.set(selection.id, selection);
  }

  const sourceByKey = indexByLocaleAndId(requireEntries(source, "Narration source"), "Narration source");
  const manifestByKey = indexByLocaleAndId(requireEntries(manifest, "Narration manifest"), "Narration manifest");

  return options.map((option) => {
    const selection = selectionById.get(option.id);
    if (!selection) throw new Error(`Missing calm mood selection: ${option.id}`);
    const candidate = option.candidates.find((item) => item.audioPath === selection.audioPath);
    if (!candidate) throw new Error(`Invalid calm mood candidate: ${option.id}`);
    if (
      selection.option !== option.option ||
      selection.text !== option.text ||
      selection.candidateId !== candidate.candidateId ||
      selection.tagId !== candidate.tagId ||
      selection.tagText !== candidate.tagText ||
      selection.resultSide !== candidate.resultSide ||
      !SAFE_SOURCE_PATH.test(selection.audioPath)
    ) {
      throw new Error(`Calm mood selection metadata mismatch: ${option.id}`);
    }

    const key = `ko:${option.id}`;
    const sourceEntry = sourceByKey.get(key);
    if (!sourceEntry || sourceEntry.text !== option.text) {
      throw new Error(`Narration source text mismatch: ${key}`);
    }
    const manifestEntry = manifestByKey.get(key);
    if (!manifestEntry || manifestEntry.text !== option.text) {
      throw new Error(`Narration manifest text mismatch: ${key}`);
    }

    return {
      id: option.id,
      text: option.text,
      option: option.option,
      candidateId: candidate.candidateId,
      sourcePath: candidate.audioPath,
      tagId: candidate.tagId,
      tagText: candidate.tagText,
      resultSide: candidate.resultSide,
      previousPath: manifestEntry.path,
      previousSha256: manifestEntry.sha256,
    };
  });
}

export function applyCalmMoodRuntimeOverrides(manifest, plan, importedEntries, appliedAt) {
  if (!Array.isArray(importedEntries) || importedEntries.length !== plan.length) {
    throw new Error(`Imported audio count mismatch: expected ${plan.length}`);
  }
  const planById = new Map(plan.map((entry) => [entry.id, entry]));
  const importedById = new Map();
  for (const entry of importedEntries) {
    if (!planById.has(entry.id)) throw new Error(`Unexpected imported narration: ${entry.id}`);
    if (importedById.has(entry.id)) throw new Error(`Duplicate imported narration: ${entry.id}`);
    if (!SAFE_SOURCE_PATH.test(entry.sourcePath)) throw new Error(`Unsafe source audio path: ${entry.id}`);
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
    if (imported.sourcePath !== planEntry.sourcePath) {
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
        choice: planEntry.resultSide,
        sourcePath: `tools/fish-day1-browser/calm-mood-candidates/${imported.sourcePath}`,
        sourceSha256: imported.sourceSha256,
        candidateId: planEntry.candidateId,
        tagId: planEntry.tagId,
        tagText: planEntry.tagText,
      },
    };
  });
  if (replaced.size !== plan.length) {
    throw new Error(`Manifest replacement count mismatch: expected ${plan.length}, received ${replaced.size}`);
  }

  const origins = entries.flatMap((entry) => entry.origin ? [entry.origin] : []);
  const maintainerSelectedEntryCount = origins.filter((origin) => "candidateId" in origin).length;
  const baseRightEntryCount = origins.length - maintainerSelectedEntryCount;
  return {
    ...manifest,
    audioOverrides: {
      schemaVersion: 1,
      locale: "ko",
      day: 1,
      provider: "Fish Audio",
      selection: "mixed",
      entryCount: origins.length,
      baseRightEntryCount,
      maintainerSelectedEntryCount,
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

async function transcodeEntry({ demoRoot, calmRoot, workRoot, entry, ffmpeg, ffprobe }) {
  const inputPath = path.join(calmRoot, ...entry.sourcePath.split("/"));
  const sourceBytes = await readFile(inputPath);
  if (sourceBytes.length === 0) throw new Error(`Selected MP3 is empty: ${entry.id}`);

  const temporaryPath = path.join(workRoot, `${entry.option}.ogg`);
  await execFileAsync(ffmpeg, [
    "-y", "-hide_banner", "-loglevel", "error", "-i", inputPath,
    "-af", "loudnorm=I=-16:TP=-1:LRA=7", "-ac", "1", "-ar", "24000",
    "-c:a", "libopus", "-b:a", "48k", "-vbr", "on", "-compression_level", "10",
    temporaryPath,
  ]);

  const outputBytes = await readFile(temporaryPath);
  const outputSha256 = sha256(outputBytes);
  const relativePath = `assets/audio/narration/ko/${outputSha256.slice(0, 24)}.ogg`;
  const finalPath = path.join(demoRoot, "public", ...relativePath.split("/"));
  await mkdir(path.dirname(finalPath), { recursive: true });
  if (await fileExists(finalPath)) {
    if (sha256(await readFile(finalPath)) !== outputSha256) {
      throw new Error(`Content-hash collision: ${relativePath}`);
    }
  } else {
    await copyFile(temporaryPath, finalPath);
  }

  const { stdout } = await execFileAsync(ffprobe, [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", finalPath,
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

export async function importSelectedCalmMoodNarration({
  demoRoot,
  calmRoot,
  ffmpeg = "ffmpeg",
  ffprobe = "ffprobe",
  appliedAt = new Date().toISOString(),
}) {
  const manifestPath = path.join(demoRoot, "public/assets/audio/narration/manifest.json");
  const modelSourcePath = path.join(demoRoot, "public/assets/audio/narration/model-source.json");
  const sourcePath = path.join(demoRoot, "tools/tts/narration-source.json");
  const auditPath = path.join(calmRoot, "calm-mood-runtime-import.json");
  const baseAuditPath = path.join(demoRoot, "tools/fish-day1-browser/day1-runtime-import.json");
  const workRoot = path.join(calmRoot, ".work", "runtime-import");
  await mkdir(workRoot, { recursive: true });

  const calmManifest = JSON.parse(await readFile(path.join(calmRoot, "manifest.json"), "utf8"));
  const selections = JSON.parse(await readFile(path.join(calmRoot, "selections.json"), "utf8"));
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const modelSource = JSON.parse(await readFile(modelSourcePath, "utf8"));
  const baseAudit = JSON.parse(await readFile(baseAuditPath, "utf8"));
  const baseAuditById = new Map(baseAudit.entries.map((entry) => [entry.id, entry]));
  const plan = buildCalmMoodRuntimePlan(calmManifest, selections, source, manifest).map((entry) => {
    const baseEntry = baseAuditById.get(entry.id);
    if (!baseEntry || baseEntry.text !== entry.text) {
      throw new Error(`Base Day 1 audit mismatch: ${entry.id}`);
    }
    return {
      ...entry,
      previousPath: baseEntry.path,
      previousSha256: baseEntry.sha256,
    };
  });

  const backupPath = path.join(workRoot, "manifest-before-calm-selection.json");
  if (!(await fileExists(backupPath))) await copyFile(manifestPath, backupPath);

  const importedEntries = [];
  for (const entry of plan) {
    importedEntries.push(await transcodeEntry({
      demoRoot,
      calmRoot,
      workRoot,
      entry,
      ffmpeg,
      ffprobe,
    }));
  }
  const updatedManifest = applyCalmMoodRuntimeOverrides(
    manifest,
    plan,
    importedEntries,
    appliedAt,
  );
  const audit = {
    schemaVersion: 1,
    locale: "ko",
    day: 1,
    questionId: "D1_Q1",
    provider: "Fish Audio",
    selection: "maintainer-selected",
    entryCount: importedEntries.length,
    appliedAt,
    entries: plan.map((entry) => ({
      ...entry,
      ...importedEntries.find((imported) => imported.id === entry.id),
    })),
  };
  const updatedModelSource = {
    ...modelSource,
    audioOverrides: {
      schemaVersion: 1,
      locale: "ko",
      day: 1,
      entryCount: updatedManifest.audioOverrides.entryCount,
      baseRightEntryCount: updatedManifest.audioOverrides.baseRightEntryCount,
      maintainerSelectedEntryCount: updatedManifest.audioOverrides.maintainerSelectedEntryCount,
      provider: "Fish Audio",
      sourceType: "user-selected-browser-export",
      selection: "mixed",
      model: "not embedded in exported MP3 metadata",
      revision: "not embedded in exported MP3 metadata",
      license: "not embedded in exported MP3 metadata",
      baseAuditPath: "tools/fish-day1-browser/day1-runtime-import.json",
      selectionAuditPath: "tools/fish-day1-browser/calm-mood-candidates/calm-mood-runtime-import.json",
      appliedAt,
    },
  };

  const referencedPaths = new Set(updatedManifest.entries.map((entry) => entry.path));
  const archiveRoot = path.join(
    workRoot,
    "replaced-assets",
    appliedAt.replace(/[^0-9A-Za-z_-]/gu, "-"),
  );
  const archiveCandidates = [];
  for (const locale of ["ko", "ja"]) {
    const localeRoot = path.join(demoRoot, "public/assets/audio/narration", locale);
    for (const file of await readdir(localeRoot)) {
      if (!file.endsWith(".ogg")) continue;
      const relativePath = `assets/audio/narration/${locale}/${file}`;
      if (referencedPaths.has(relativePath)) continue;
      archiveCandidates.push({
        relativePath,
        previousPath: path.join(localeRoot, file),
        locale,
      });
    }
  }

  await writeJsonAtomic(manifestPath, updatedManifest);
  await writeJsonAtomic(modelSourcePath, updatedModelSource);
  const archivedPreviousPaths = [];
  for (const candidate of archiveCandidates) {
    const localeArchiveRoot = path.join(archiveRoot, candidate.locale);
    await mkdir(localeArchiveRoot, { recursive: true });
    await rename(candidate.previousPath, path.join(localeArchiveRoot, path.basename(candidate.previousPath)));
    archivedPreviousPaths.push(candidate.relativePath);
  }
  audit.archivedPreviousPaths = archivedPreviousPaths;
  await writeJsonAtomic(auditPath, audit);
  return { manifest: updatedManifest, audit };
}
