import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { runSttReviewScoring } from "./score-stt-review.mjs";

function review() {
  const shared = {
    pairId: "clip-001",
    clipId: "clip-001",
    locale: "ko-KR",
    status: "completed",
    noSpeech: false,
    retryCount: 0,
    audioDurationMs: 3000,
    referenceTranscript: "오늘 공원 산책",
    usableTranscript: true,
    semanticSlots: [
      { slotId: "place", expectedValues: ["공원"], preserved: true },
      { slotId: "activity", expectedValues: ["산책"], preserved: true },
    ],
  };
  return {
    schemaVersion: "haru-local-stt-restricted-review-v1",
    generatedAt: "2026-08-06T00:00:00.000Z",
    isSynthetic: false,
    consentConfirmed: true,
    purpose: "local_product_usability_evaluation",
    restricted: true,
    doNotCommit: true,
    containsRealAudio: false,
    containsRestrictedTranscript: true,
    humanReviewComplete: true,
    sttReviewRows: [
      {
        ...shared,
        reviewRowId: "clip-001|condition_a",
        conditionCode: "condition_a",
        latencyMs: 1500,
        hypothesisTranscript: "오늘 공원",
        usableTranscript: false,
        semanticSlots: [
          { slotId: "place", expectedValues: ["공원"], preserved: true },
          { slotId: "activity", expectedValues: ["산책"], preserved: false },
        ],
      },
      {
        ...shared,
        reviewRowId: "clip-001|condition_b",
        conditionCode: "condition_b",
        latencyMs: 1700,
        hypothesisTranscript: "오늘 공원 산책",
      },
    ],
    blinded: true,
  };
}

function mapping() {
  return {
    schemaVersion: "haru-local-stt-condition-map-v1",
    generatedAt: "2026-08-06T00:00:00.000Z",
    consentConfirmed: true,
    purpose: "local_product_usability_evaluation",
    restricted: true,
    doNotShareWithReviewer: true,
    rows: [
      {
        reviewRowId: "clip-001|condition_a",
        pairId: "clip-001",
        conditionCode: "condition_a",
        voiceExperienceVariant: "baseline_v1",
        preprocessingVersion: "decode-resample-only-v1",
        inferenceOrder: 1,
      },
      {
        reviewRowId: "clip-001|condition_b",
        pairId: "clip-001",
        conditionCode: "condition_b",
        voiceExperienceVariant: "assist_v2",
        preprocessingVersion: "haru-dc-hp80-rms-v2",
        inferenceOrder: 2,
      },
    ],
  };
}

test("scores completed human review and writes transcript-free metrics", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "haru-stt-review-score-"));
  const reviewPath = path.join(root, "restricted_review.json");
  const mappingPath = path.join(root, "condition_mapping.json");
  const outputPath = path.join(root, "stt_metrics.json");
  await writeFile(reviewPath, JSON.stringify(review()), "utf8");
  await writeFile(mappingPath, JSON.stringify(mapping()), "utf8");

  const result = await runSttReviewScoring({ reviewPath, mappingPath, outputPath });
  assert.equal(result.metrics.disclosure.containsTranscript, false);
  assert.equal(result.metrics.stt.primaryMetric, "human_usable_transcript_rate");
  assert.equal(result.metrics.stt.paired.pairCount, 1);
  assert.equal(result.metrics.stt.paired.usableTranscriptRateDelta, 1);
  assert.equal(result.metrics.stt.preprocessing.assist, "haru-dc-hp80-rms-v2");
  const serialized = await readFile(outputPath, "utf8");
  assert.doesNotMatch(serialized, /오늘 공원|referenceTranscript|hypothesisTranscript|expectedValues/);
});

test("refuses incomplete or unconsented human review", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "haru-stt-review-invalid-"));
  const reviewPath = path.join(root, "restricted_review.json");
  const mappingPath = path.join(root, "condition_mapping.json");
  const outputPath = path.join(root, "stt_metrics.json");
  await writeFile(mappingPath, JSON.stringify(mapping()), "utf8");
  const incomplete = review();
  incomplete.humanReviewComplete = false;
  await writeFile(reviewPath, JSON.stringify(incomplete), "utf8");
  await assert.rejects(
    runSttReviewScoring({ reviewPath, mappingPath, outputPath }),
    /humanReviewComplete/,
  );

  const unconsented = review();
  unconsented.consentConfirmed = false;
  await writeFile(reviewPath, JSON.stringify(unconsented), "utf8");
  await assert.rejects(
    runSttReviewScoring({ reviewPath, mappingPath, outputPath }),
    /consentConfirmed/,
  );
});

test("refuses missing or duplicate blinded condition pairs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "haru-stt-review-pairs-"));
  const reviewPath = path.join(root, "restricted_review.json");
  const mappingPath = path.join(root, "condition_mapping.json");
  const outputPath = path.join(root, "stt_metrics.json");
  const incomplete = review();
  incomplete.sttReviewRows.pop();
  await writeFile(reviewPath, JSON.stringify(incomplete), "utf8");
  await writeFile(mappingPath, JSON.stringify(mapping()), "utf8");
  await assert.rejects(
    runSttReviewScoring({ reviewPath, mappingPath, outputPath }),
    /exactly two blinded conditions/i,
  );

  const duplicate = review();
  duplicate.sttReviewRows[1].conditionCode = "condition_a";
  duplicate.sttReviewRows[1].reviewRowId = "clip-001|condition_a";
  await writeFile(reviewPath, JSON.stringify(duplicate), "utf8");
  await assert.rejects(
    runSttReviewScoring({ reviewPath, mappingPath, outputPath }),
    /duplicate reviewRowId|condition/i,
  );
});
