#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectManifestFiles,
  isMainModule,
  resolveManifestArtifactPath,
  scanRuntimeText,
  validateRuntimeConfig,
} from "./runtime-utils.mjs";

const demoRoot = fileURLToPath(new URL("..", import.meta.url));
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".mjs", ".svg", ".webmanifest"]);
const REQUIRED_MANIFESTS = [
  "assets/audio/ui/manifest.json",
  "assets/audio/narration/manifest.json",
];
const NARRATION_MANIFEST_PATH = "assets/audio/narration/manifest.json";
const PRODUCTION_NARRATION_SOURCE = path.join(demoRoot, "tools", "tts", "narration-source.json");

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

export function hashCanonicalJson(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

async function walkFiles(rootDirectory, currentDirectory = rootDirectory) {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(currentDirectory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Offline build must not contain symlinks: ${path.relative(rootDirectory, absolute)}`);
    }
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(rootDirectory, absolute)));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }
  return files;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON ${filePath}: ${detail}`);
  }
}

function collectChecksums(manifestPath, manifest) {
  const checksums = new Map();
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const artifactPath = value.file ?? value.path ?? value.audioFile ?? value.audioPath;
    if (
      typeof artifactPath === "string" &&
      typeof value.sha256 === "string" &&
      /^[a-f0-9]{64}$/i.test(value.sha256)
    ) {
      checksums.set(
        resolveManifestArtifactPath(manifestPath, artifactPath),
        value.sha256.toLowerCase(),
      );
    }
    Object.values(value).forEach(visit);
  };
  visit(manifest);
  return checksums;
}

async function assertArtifact(rootDirectory, relativeFile) {
  const absolute = path.join(rootDirectory, ...relativeFile.split("/"));
  const metadata = await stat(absolute).catch(() => null);
  if (!metadata?.isFile() || metadata.size === 0) {
    throw new Error(`Missing or empty required artifact: ${relativeFile}`);
  }
  return absolute;
}

async function verifyManifest(rootDirectory, relativeManifest) {
  const manifestFile = await assertArtifact(rootDirectory, relativeManifest);
  const manifest = await readJson(manifestFile);
  const referencedFiles = collectManifestFiles(relativeManifest, manifest);
  if (referencedFiles.length === 0) {
    throw new Error(`Audio manifest has no local audio files: ${relativeManifest}`);
  }
  const checksums = collectChecksums(relativeManifest, manifest);
  for (const relativeFile of referencedFiles) {
    const absolute = await assertArtifact(rootDirectory, relativeFile);
    const expected = checksums.get(relativeFile);
    if (expected) {
      const actual = createHash("sha256").update(await readFile(absolute)).digest("hex");
      if (actual !== expected) {
        throw new Error(`Checksum mismatch for ${relativeFile}: expected ${expected}, received ${actual}`);
      }
    }
  }
  return { manifest, referencedFileCount: referencedFiles.length };
}

function narrationEntryMap(entries, label) {
  if (!Array.isArray(entries)) throw new Error(`${label}.entries must be an array.`);
  const result = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${label} contains an invalid entry.`);
    }
    if (!["ko", "ja"].includes(entry.locale) || typeof entry.id !== "string" || entry.id.length === 0) {
      throw new Error(`${label} entry must have locale ko/ja and a non-empty id.`);
    }
    if (typeof entry.text !== "string" || entry.text.length === 0) {
      throw new Error(`${label} entry has empty text: ${entry.locale}:${entry.id}`);
    }
    const key = `${entry.locale}:${entry.id}`;
    if (result.has(key)) throw new Error(`${label} contains duplicate entry ${key}.`);
    result.set(key, entry);
  }
  return result;
}

function assertMatchingNarrationModel(source, manifest, modelSource) {
  if (!source?.model || !manifest?.model) {
    throw new Error("Narration source and manifest must include model metadata.");
  }
  for (const field of ["id", "revision", "license", "sourceUrl"]) {
    if (
      typeof source.model[field] !== "string" ||
      source.model[field].length === 0 ||
      manifest.model[field] !== source.model[field]
    ) {
      throw new Error(`Narration model mismatch for ${field}.`);
    }
  }
  const provenanceFields = {
    model: source.model.id,
    revision: source.model.revision,
    license: source.model.license,
    source: source.model.sourceUrl,
  };
  for (const [field, expected] of Object.entries(provenanceFields)) {
    if (modelSource[field] !== expected) {
      throw new Error(`Narration model provenance mismatch for ${field}.`);
    }
  }
}

async function verifyStrictNarration(
  rootDirectory,
  manifest,
  modelSource,
  { narrationSourcePath },
) {
  const source = await readJson(narrationSourcePath);
  if (source?.schemaVersion !== 1 || manifest?.schemaVersion !== 1) {
    throw new Error("Narration source and manifest schemaVersion must be 1.");
  }
  const sourceEntries = narrationEntryMap(source.entries, "Narration source");
  const manifestEntries = narrationEntryMap(manifest.entries, "Narration manifest");
  const missing = [...sourceEntries.keys()].filter((key) => !manifestEntries.has(key));
  const extra = [...manifestEntries.keys()].filter((key) => !sourceEntries.has(key));
  if (manifestEntries.size !== sourceEntries.size || missing.length > 0 || extra.length > 0) {
    const details = [
      missing.length > 0 ? `missing ${missing.slice(0, 5).join(", ")}` : null,
      extra.length > 0 ? `extra ${extra.slice(0, 5).join(", ")}` : null,
    ].filter(Boolean);
    throw new Error(
      `Narration manifest incomplete: received ${manifestEntries.size} of ${sourceEntries.size} entries${details.length > 0 ? `; ${details.join("; ")}` : ""}.`,
    );
  }

  assertMatchingNarrationModel(source, manifest, modelSource);
  const expectedSourceHash = hashCanonicalJson(source);
  if (manifest.sourceSha256 !== expectedSourceHash) {
    throw new Error(
      `Narration sourceSha256 mismatch: expected ${expectedSourceHash}, received ${manifest.sourceSha256 ?? "missing"}.`,
    );
  }

  const calculatedHashes = new Map();
  for (const [key, sourceEntry] of sourceEntries) {
    const entry = manifestEntries.get(key);
    if (entry.text !== sourceEntry.text) {
      throw new Error(`Narration text mismatch: ${key}.`);
    }
    if (
      typeof entry.path !== "string" ||
      entry.path !== entry.audioPath ||
      !entry.path.startsWith(`assets/audio/narration/${entry.locale}/`) ||
      !entry.path.endsWith(".ogg") ||
      entry.path.split("/").includes("..")
    ) {
      throw new Error(`Invalid narration path: ${key}.`);
    }
    if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
      throw new Error(`Invalid narration checksum: ${key}.`);
    }
    if (!Number.isFinite(entry.durationMs) || entry.durationMs <= 0) {
      throw new Error(`Invalid narration duration: ${key}.`);
    }

    let actualHash = calculatedHashes.get(entry.path);
    if (!actualHash) {
      const artifact = await assertArtifact(rootDirectory, entry.path);
      actualHash = createHash("sha256").update(await readFile(artifact)).digest("hex");
      calculatedHashes.set(entry.path, actualHash);
    }
    if (actualHash !== entry.sha256.toLowerCase()) {
      throw new Error(
        `Narration checksum mismatch for ${key}: expected ${entry.sha256}, received ${actualHash}.`,
      );
    }
  }
  return {
    entryCount: sourceEntries.size,
    localeCounts: Object.fromEntries(
      ["ko", "ja"].map((locale) => [
        locale,
        [...sourceEntries.keys()].filter((key) => key.startsWith(`${locale}:`)).length,
      ]),
    ),
  };
}

export async function checkBuildDirectory(buildDirectory, options = {}) {
  const rootDirectory = path.resolve(buildDirectory);
  const rootMetadata = await stat(rootDirectory).catch(() => null);
  if (!rootMetadata?.isDirectory()) {
    throw new Error(`Build directory does not exist: ${rootDirectory}`);
  }

  const indexFile = await assertArtifact(rootDirectory, "index.html");
  const indexHtml = await readFile(indexFile, "utf8");
  if (/\b(?:src|href)=["']\/(?!\/)/i.test(indexHtml)) {
    throw new Error("index.html contains root-absolute assets; Vite base must stay './'.");
  }
  if (/\/src\/main\.(?:js|jsx|ts|tsx)/i.test(indexHtml)) {
    throw new Error("index.html still references development source instead of a production bundle.");
  }

  const runtimeConfig = validateRuntimeConfig(
    await readJson(await assertArtifact(rootDirectory, "config/runtime.json")),
  );
  const buildInfo = await readJson(await assertArtifact(rootDirectory, "config/build-info.json"));
  if (buildInfo?.offline !== true || !["kr", "jp"].includes(buildInfo?.market)) {
    throw new Error("config/build-info.json must identify a kr/jp offline build.");
  }
  await assertArtifact(rootDirectory, "assets/audio/ui/LICENSE.txt");
  const modelSource = await readJson(
    await assertArtifact(rootDirectory, "assets/audio/narration/model-source.json"),
  );
  if (
    modelSource?.model !== "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice" ||
    modelSource?.license !== "Apache-2.0" ||
    typeof modelSource?.revision !== "string" ||
    modelSource.revision.length === 0
  ) {
    throw new Error("Narration model provenance is missing model, revision, or Apache-2.0 license.");
  }

  let manifestAudioFiles = 0;
  let narrationManifest = null;
  for (const manifestPath of REQUIRED_MANIFESTS) {
    const result = await verifyManifest(rootDirectory, manifestPath);
    manifestAudioFiles += result.referencedFileCount;
    if (manifestPath === NARRATION_MANIFEST_PATH) narrationManifest = result.manifest;
  }

  let narrationCoverage = null;
  if (options.strictNarration === true) {
    narrationCoverage = await verifyStrictNarration(rootDirectory, narrationManifest, modelSource, {
      narrationSourcePath: path.resolve(
        options.narrationSourcePath ?? PRODUCTION_NARRATION_SOURCE,
      ),
    });
  }

  const files = await walkFiles(rootDirectory);
  if (!files.some((file) => path.extname(file).toLowerCase() === ".js")) {
    throw new Error("Offline build contains no JavaScript bundle.");
  }

  const findings = [];
  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    const relative = path.relative(rootDirectory, file).replaceAll("\\", "/");
    findings.push(...scanRuntimeText(relative, await readFile(file, "utf8")));
  }
  if (findings.length > 0) {
    throw new Error(`Forbidden online/backend references found:\n- ${findings.join("\n- ")}`);
  }

  return {
    rootDirectory,
    market: buildInfo.market,
    runtimeConfig,
    fileCount: files.length,
    manifestAudioFiles,
    narrationEntryCount: narrationCoverage?.entryCount ?? null,
    narrationLocaleCounts: narrationCoverage?.localeCounts ?? null,
  };
}

async function main() {
  const argumentsList = process.argv.slice(2);
  const targets =
    argumentsList.length > 0
      ? argumentsList
      : [path.join("dist", "ko"), path.join("dist", "ja")];
  for (const target of targets) {
    const result = await checkBuildDirectory(path.resolve(demoRoot, target), {
      strictNarration: true,
      narrationSourcePath: PRODUCTION_NARRATION_SOURCE,
    });
    process.stdout.write(
      `Offline build OK: ${path.relative(demoRoot, result.rootDirectory)} (${result.market}, ${result.fileCount} files, ${result.manifestAudioFiles} manifest audio files, ${result.narrationEntryCount} exact narration entries: ko ${result.narrationLocaleCounts.ko}, ja ${result.narrationLocaleCounts.ja})\n`,
    );
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
