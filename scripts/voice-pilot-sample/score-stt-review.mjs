#!/usr/bin/env node
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeSttReviewRows } from "./analysis-core.mjs";

const METRICS_SCHEMA_VERSION = "haru-local-stt-sanitized-metrics-v1";

async function exists(filename) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filename, label) {
  let source;
  try {
    source = await readFile(filename, "utf8");
  } catch (error) {
    throw new Error(`Cannot read ${label}: ${filename}. ${error.message}`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid ${label} JSON: ${error.message}`);
  }
}

function validateCompletedReview(review, mapping) {
  if (!review || typeof review !== "object" || Array.isArray(review)) {
    throw new Error("Restricted STT review must be an object.");
  }
  if (review.consentConfirmed !== true) {
    throw new Error("consentConfirmed=true is required before scoring.");
  }
  if (review.purpose !== "local_product_usability_evaluation") {
    throw new Error("Review purpose must be local_product_usability_evaluation.");
  }
  if (review.restricted !== true || review.containsRestrictedTranscript !== true) {
    throw new Error("Restricted review classification is missing.");
  }
  if (review.containsRealAudio !== false) {
    throw new Error("Scorer accepts transcript review only; containsRealAudio must be false.");
  }
  if (review.humanReviewComplete !== true) {
    throw new Error("humanReviewComplete=true is required after blind review.");
  }
  if (review.blinded !== true) throw new Error("blinded=true is required for human review.");
  if (
    !mapping ||
    mapping.schemaVersion !== "haru-local-stt-condition-map-v1" ||
    mapping.consentConfirmed !== true ||
    mapping.purpose !== "local_product_usability_evaluation" ||
    mapping.doNotShareWithReviewer !== true
  ) {
    throw new Error("Valid separate blinded condition mapping is required.");
  }
  const rows = Array.isArray(review.sttReviewRows) ? review.sttReviewRows : [];
  if (!rows.length) throw new Error("sttReviewRows must be non-empty.");
  const mappingRows = Array.isArray(mapping.rows) ? mapping.rows : [];
  if (!mappingRows.length) throw new Error("Condition mapping rows must be non-empty.");

  const reviewById = new Map();
  const reviewsByPair = new Map();
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`sttReviewRows[${index}] must be an object.`);
    }
    if (row.voiceExperienceVariant !== undefined || row.preprocessingVersion !== undefined) {
      throw new Error(`sttReviewRows[${index}] exposes condition identity; review is not blind.`);
    }
    const rowId = String(row.reviewRowId ?? "").trim();
    const pairId = String(row.pairId ?? "").trim();
    const conditionCode = String(row.conditionCode ?? "").trim();
    if (!rowId || !pairId || !conditionCode) {
      throw new Error(`sttReviewRows[${index}] requires reviewRowId, pairId, and conditionCode.`);
    }
    if (reviewById.has(rowId)) throw new Error(`duplicate reviewRowId: ${rowId}`);
    reviewById.set(rowId, row);
    const pairRows = reviewsByPair.get(pairId) ?? [];
    pairRows.push(row);
    reviewsByPair.set(pairId, pairRows);
    if (typeof row.usableTranscript !== "boolean") {
      throw new Error(`sttReviewRows[${index}].usableTranscript human label is null.`);
    }
    if (!Array.isArray(row.semanticSlots) || !row.semanticSlots.length) {
      throw new Error(`sttReviewRows[${index}].semanticSlots must be non-empty.`);
    }
    for (const [slotIndex, slot] of row.semanticSlots.entries()) {
      if (typeof slot?.preserved !== "boolean") {
        throw new Error(
          `sttReviewRows[${index}].semanticSlots[${slotIndex}].preserved human label is null.`,
        );
      }
    }
  }
  for (const [pairId, pairRows] of reviewsByPair) {
    if (pairRows.length !== 2 || new Set(pairRows.map((row) => row.conditionCode)).size !== 2) {
      throw new Error(`Pair ${pairId} must contain exactly two blinded conditions.`);
    }
  }

  const mappingById = new Map();
  const mappingsByPair = new Map();
  for (const [index, row] of mappingRows.entries()) {
    const rowId = String(row?.reviewRowId ?? "").trim();
    const pairId = String(row?.pairId ?? "").trim();
    if (!rowId || !pairId || !row?.conditionCode) {
      throw new Error(`mapping.rows[${index}] requires reviewRowId, pairId, and conditionCode.`);
    }
    if (mappingById.has(rowId)) throw new Error(`duplicate mapping reviewRowId: ${rowId}`);
    mappingById.set(rowId, row);
    const pairRows = mappingsByPair.get(pairId) ?? [];
    pairRows.push(row);
    mappingsByPair.set(pairId, pairRows);
  }
  if (mappingById.size !== reviewById.size) {
    throw new Error("Condition mapping and blinded review row counts must match exactly.");
  }

  const joined = [];
  for (const [pairId, pairRows] of reviewsByPair) {
    const pairMappings = mappingsByPair.get(pairId) ?? [];
    const variants = new Set(pairMappings.map((row) => row.voiceExperienceVariant));
    if (
      pairMappings.length !== 2 ||
      variants.size !== 2 ||
      !variants.has("baseline_v1") ||
      !variants.has("assist_v2")
    ) {
      throw new Error(`Pair ${pairId} mapping must contain exactly baseline_v1 and assist_v2.`);
    }
    for (const reviewRow of pairRows) {
      const mapped = mappingById.get(reviewRow.reviewRowId);
      if (
        !mapped ||
        mapped.pairId !== reviewRow.pairId ||
        mapped.conditionCode !== reviewRow.conditionCode
      ) {
        throw new Error(`Missing exact condition mapping for ${reviewRow.reviewRowId}.`);
      }
      const expectedPreprocessing =
        mapped.voiceExperienceVariant === "assist_v2"
          ? "haru-dc-hp80-rms-v2"
          : "decode-resample-only-v1";
      if (mapped.preprocessingVersion !== expectedPreprocessing) {
        throw new Error(`Invalid preprocessing metadata for ${reviewRow.reviewRowId}.`);
      }
      joined.push({
        ...reviewRow,
        voiceExperienceVariant: mapped.voiceExperienceVariant,
        preprocessingVersion: mapped.preprocessingVersion,
        inferenceOrder: mapped.inferenceOrder,
      });
    }
  }
  return joined;
}

function sanitizedMetrics(review, rows) {
  const stt = analyzeSttReviewRows(rows);
  return {
    schemaVersion: METRICS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: review.generatedAt ?? null,
    purpose: "local_product_usability_evaluation",
    disclosure: {
      dataSource: "consented_local_audio_human_review",
      containsTranscript: false,
      containsAudio: false,
      clinicalPerformanceClaim: false,
      warning:
        "로컬 동의 음성의 제품 사용성 평가다. 임상 결과나 질환 판단이 아니며 표본 밖 성능을 보장하지 않는다.",
      latencyNote:
        "고정 규칙으로 추론 순서를 교차 배치했지만 지연은 로컬 장비·캐시 영향을 받는 기술 지표이며 인과 효과가 아니다.",
    },
    reviewRowCount: rows.length,
    stt,
  };
}

function assertSanitized(serialized) {
  const forbiddenKeys = [
    "referenceTranscript",
    "hypothesisTranscript",
    "expectedValues",
    "audioPath",
    "audioObjectKey",
  ];
  for (const key of forbiddenKeys) {
    if (serialized.includes(key)) throw new Error(`Sanitized STT metrics contain forbidden key: ${key}`);
  }
}

export async function runSttReviewScoring({ reviewPath, mappingPath, outputPath, force = false }) {
  if (!reviewPath) throw new Error("reviewPath is required.");
  if (!mappingPath) throw new Error("mappingPath is required.");
  if (!outputPath) throw new Error("outputPath is required.");
  const resolvedReviewPath = path.resolve(reviewPath);
  const resolvedMappingPath = path.resolve(mappingPath);
  const resolvedOutputPath = path.resolve(outputPath);
  if (!force && (await exists(resolvedOutputPath))) {
    throw new Error("Output exists; pass force=true or --force to replace sanitized metrics.");
  }
  const review = await readJson(resolvedReviewPath, "restricted STT review");
  const mapping = await readJson(resolvedMappingPath, "condition mapping");
  const rows = validateCompletedReview(review, mapping);
  const metrics = sanitizedMetrics(review, rows);
  const serialized = `${JSON.stringify(metrics, null, 2)}\n`;
  assertSanitized(serialized);
  await writeFile(resolvedOutputPath, serialized, "utf8");
  return {
    metrics,
    reviewPath: resolvedReviewPath,
    mappingPath: resolvedMappingPath,
    outputPath: resolvedOutputPath,
  };
}

function usage() {
  return `Usage: node scripts/voice-pilot-sample/score-stt-review.mjs --review <path> --mapping <path> --output <path> [--force]

Scores a human-completed restricted review and writes transcript-free metrics.
The restricted input remains local and must not be committed.
`;
}

function parseArguments(argv) {
  const options = { force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--force") {
      options.force = true;
      continue;
    }
    if (["--review", "--mapping", "--output"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}.`);
      index += 1;
      if (argument === "--review") options.reviewPath = value;
      if (argument === "--mapping") options.mappingPath = value;
      if (argument === "--output") options.outputPath = value;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}.`);
  }
  return options;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
    } else {
      const result = await runSttReviewScoring(options);
      process.stdout.write(
        `Transcript-free STT metrics written: ${result.outputPath}\n` +
          `Review rows: ${result.metrics.reviewRowCount}; paired: ${result.metrics.stt.paired.pairCount}\n`,
      );
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
