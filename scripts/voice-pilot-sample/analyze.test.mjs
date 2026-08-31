import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { runAnalysisPipeline } from "./analyze.mjs";

test("writes complete sanitized analysis package from canonical operational export", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "haru-sample-analysis-"));
  const inputPath = path.join(temporaryRoot, "operational_export.json");
  const outputDirectory = path.join(temporaryRoot, "analysis");
  const operational = {
    schemaVersion: "haru-voice-pilot-sample-operational-v1",
    generatedAt: "2026-08-06T00:00:00.000Z",
    dataKind: "sample",
    seed: 9,
    participants: [{ participantId: "SYN-001", voiceExperienceVariant: "assist_v2" }],
    routineSessions: [
      { participantId: "SYN-001", sessionId: "S1", day: 1, state: "completed" },
    ],
    questionAttempts: [
      {
        participantId: "SYN-001",
        sessionId: "S1",
        questionId: "D1_Q5",
        questionType: "voice",
        day: 1,
        status: "completed",
        response: { isValid: true, retryCount: 0 },
      },
    ],
    telemetryEvents: [],
  };
  const restrictedReview = {
    schemaVersion: "haru-voice-pilot-sample-operational-v1",
    generatedAt: "2026-08-06T00:00:00.000Z",
    dataKind: "sample",
    classification: "restricted_stt_review",
    rows: [
      {
        participantId: "SYN-001",
        pairId: "P1",
        voiceExperienceVariant: "assist_v2",
        day: 1,
        questionId: "D1_Q5",
        sessionId: "S1",
        status: "completed",
        noSpeech: false,
        retryCount: 0,
        latencyMs: 2000,
        referenceTranscript: "제한된 검토 원문",
        hypothesisTranscript: "제한된 검토 원문",
        usableTranscript: true,
        preprocessingVersion: "haru-dc-hp80-rms-v2",
        semanticSlots: [{ slotId: "topic", expectedValues: ["원문"], preserved: true }],
      },
    ],
  };
  await writeFile(inputPath, JSON.stringify(operational), "utf8");
  const restrictedDirectory = path.join(temporaryRoot, "restricted");
  await mkdir(restrictedDirectory, { recursive: true });
  await writeFile(
    path.join(restrictedDirectory, "stt_review_rows.json"),
    JSON.stringify(restrictedReview),
    "utf8",
  );

  const result = await runAnalysisPipeline({ inputPath, outputDirectory });
  assert.equal(result.analysis.overview.participantCount, 1);
  assert.equal(result.analysis.stt.variants.length, 1);
  assert.equal(result.outputDirectory, outputDirectory);
  const outputNames = (await readdir(outputDirectory)).sort();
  assert.deepEqual(outputNames, [
    "artifact-index.json",
    "charts",
    "dashboard.html",
    "findings.md",
    "methodology.md",
    "metrics.json",
  ]);
  assert.deepEqual((await readdir(path.join(outputDirectory, "charts"))).sort(), [
    "01_daily_retention.svg",
    "02_participant_week.svg",
    "03_stt_variant_comparison.svg",
    "04_question_dropoff_hotspots.svg",
    "05_question_timing.svg",
    "06_cohort_completion.svg",
  ]);

  const artifactIndex = JSON.parse(
    await readFile(path.join(outputDirectory, "artifact-index.json"), "utf8"),
  );
  assert.equal(artifactIndex.schemaVersion, "haru-voice-pilot-sample-analysis-artifacts-v1");
  assert.equal(artifactIndex.inventoryScope, "analysis_outputs_only");
  assert.equal(artifactIndex.dataset.dataKind, "sample");
  assert.equal(artifactIndex.dataset.containsRestrictedTranscript, false);
  assert.deepEqual(
    artifactIndex.artifacts.map((artifact) => artifact.path).sort(),
    [
      "artifact-index.json",
      "charts/01_daily_retention.svg",
      "charts/02_participant_week.svg",
      "charts/03_stt_variant_comparison.svg",
      "charts/04_question_dropoff_hotspots.svg",
      "charts/05_question_timing.svg",
      "charts/06_cohort_completion.svg",
      "dashboard.html",
      "findings.md",
      "methodology.md",
      "metrics.json",
    ].sort(),
  );
  assert.equal(artifactIndex.totals.analysis, 10);
  assert.equal(artifactIndex.totals.capture, 0);
  assert.equal(artifactIndex.totals.inventory, 1);
  assert.equal(artifactIndex.totals.all, 11);

  for (const filename of [
    "artifact-index.json",
    "metrics.json",
    "dashboard.html",
    "findings.md",
    "methodology.md",
  ]) {
    const content = await readFile(path.join(outputDirectory, filename), "utf8");
    assert.doesNotMatch(content, /제한된 검토 원문/);
    if (filename !== "methodology.md") {
      assert.doesNotMatch(content, /referenceTranscript|hypothesisTranscript/);
    }
  }
});

test("refuses a non-sample export", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "haru-nonsample-analysis-"));
  const inputPath = path.join(temporaryRoot, "operational_export.json");
  await writeFile(inputPath, JSON.stringify({ dataKind: "production" }), "utf8");

  await assert.rejects(
    runAnalysisPipeline({ inputPath, outputDirectory: path.join(temporaryRoot, "analysis") }),
    /sample/i,
  );
});

test("refuses voice analysis when separated restricted review is missing", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "haru-missing-review-"));
  const inputPath = path.join(temporaryRoot, "operational_export.json");
  await writeFile(
    inputPath,
    JSON.stringify({
      dataKind: "sample",
      participants: [{ participantId: "SYN-001" }],
      routineSessions: [],
      questionAttempts: [{ participantId: "SYN-001", questionType: "voice" }],
    }),
    "utf8",
  );

  await assert.rejects(
    runAnalysisPipeline({ inputPath, outputDirectory: path.join(temporaryRoot, "analysis") }),
    /restricted[\\/]stt_review_rows\.json/i,
  );
});

test("refuses empty or non-sample separated review for voice attempts", async () => {
  for (const restrictedReview of [
    { dataKind: "sample", rows: [] },
    { dataKind: "production", rows: [] },
  ]) {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "haru-invalid-review-"));
    const inputPath = path.join(temporaryRoot, "operational_export.json");
    const restrictedDirectory = path.join(temporaryRoot, "restricted");
    await mkdir(restrictedDirectory, { recursive: true });
    await writeFile(
      inputPath,
      JSON.stringify({
        dataKind: "sample",
        participants: [{ participantId: "SYN-001" }],
        routineSessions: [],
        questionAttempts: [{ participantId: "SYN-001", questionType: "voice" }],
      }),
      "utf8",
    );
    await writeFile(
      path.join(restrictedDirectory, "stt_review_rows.json"),
      JSON.stringify(restrictedReview),
      "utf8",
    );

    await assert.rejects(
      runAnalysisPipeline({
        inputPath,
        outputDirectory: path.join(temporaryRoot, "analysis"),
      }),
      /sample|non-empty|review rows/i,
    );
  }
});
