import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeSyntheticPilot,
  analyzeSttReviewRows,
  characterErrorRate,
  editDistance,
  wordErrorRate,
} from "./analysis-core.mjs";

const operational = {
  schemaVersion: "haru-voice-pilot-sample-operational-v1",
  generatedAt: "2026-08-06T00:00:00.000Z",
  dataKind: "sample",
  seed: 20260806,
  participants: [
    { participantId: "SYN-001", ageBand: "70-79", preferredInputMode: "touch" },
    { participantId: "SYN-002", ageBand: "80-89", preferredInputMode: "key_action" },
  ],
  routineSessions: [
    {
      participantId: "SYN-001",
      sessionId: "S1-D1",
      day: 1,
      status: "completed",
      activeDurationMs: 90_000,
      wallDurationMs: 100_000,
    },
    {
      participantId: "SYN-001",
      sessionId: "S1-D2",
      day: 2,
      status: "completed",
      activeDurationMs: 86_000,
      wallDurationMs: 96_000,
    },
    {
      participantId: "SYN-002",
      sessionId: "S2-D1",
      day: 1,
      status: "exit_observed",
      activeDurationMs: 45_000,
      wallDurationMs: 70_000,
    },
  ],
  questionAttempts: [
    {
      participantId: "SYN-001",
      sessionId: "S1-D1",
      questionInstanceId: "Q1",
      questionId: "D1_Q5",
      questionType: "voice",
      day: 1,
      ordinal: 5,
      completedAt: "2026-08-06T00:01:00.000Z",
      activeDurationMs: 18_000,
      wallDurationMs: 20_000,
      firstInteractionMs: 1_000,
      confirmationLatencyMs: 12_000,
      response: { isValid: true, retryCount: 0, hintCount: 0 },
    },
    {
      participantId: "SYN-002",
      sessionId: "S2-D1",
      questionInstanceId: "Q2",
      questionId: "D1_Q5",
      questionType: "voice",
      day: 1,
      ordinal: 5,
      activeDurationMs: 15_000,
      wallDurationMs: 25_000,
      firstInteractionMs: 2_000,
      response: { isValid: false, retryCount: 1, hintCount: 0, skipReason: "no_speech" },
    },
  ],
  telemetryEvents: [],
};

const review = {
  schemaVersion: "haru-voice-pilot-sample-stt-review-v1",
  dataKind: "sample",
  sttReviewRows: [
    {
      participantId: "SYN-001",
      pairId: "PAIR-1",
      voiceExperienceVariant: "baseline",
      day: 1,
      questionId: "D1_Q5",
      sessionId: "S1-D1",
      status: "completed",
      noSpeech: false,
      retryCount: 1,
      latencyMs: 4_000,
      audioDurationMs: 12_000,
      referenceTranscript: "오늘 공원 산책",
      hypothesisTranscript: "오늘 공원",
      usableTranscript: false,
      preprocessingVersion: "decode-resample-only-v1",
      semanticSlots: [
        { slotId: "activity", expectedValues: ["산책"] },
        { slotId: "place", expectedValues: ["공원"] },
      ],
    },
    {
      participantId: "SYN-001",
      pairId: "PAIR-1",
      voiceExperienceVariant: "assist",
      day: 1,
      questionId: "D1_Q5",
      sessionId: "S1-D1",
      status: "completed",
      noSpeech: false,
      retryCount: 0,
      latencyMs: 2_000,
      audioDurationMs: 12_000,
      referenceTranscript: "오늘 공원 산책",
      hypothesisTranscript: "오늘 공원 산책",
      usableTranscript: true,
      preprocessingVersion: "haru-dc-hp80-rms-v2",
      semanticSlots: [
        { slotId: "activity", expectedValues: ["산책"] },
        { slotId: "place", expectedValues: ["공원"] },
      ],
    },
    {
      participantId: "SYN-002",
      pairId: "PAIR-2",
      voiceExperienceVariant: "baseline",
      day: 1,
      questionId: "D1_Q5",
      sessionId: "S2-D1",
      status: "no_speech",
      noSpeech: true,
      retryCount: 1,
      latencyMs: 6_000,
      audioDurationMs: 8_000,
      referenceTranscript: "딸과 통화",
      hypothesisTranscript: "",
      usableTranscript: false,
      droppedAtVoiceStep: true,
      preprocessingVersion: "decode-resample-only-v1",
      semanticSlots: [{ slotId: "activity", expectedValues: ["통화"] }],
    },
    {
      participantId: "SYN-002",
      pairId: "PAIR-2",
      voiceExperienceVariant: "assist",
      day: 1,
      questionId: "D1_Q5",
      sessionId: "S2-D1",
      status: "completed",
      noSpeech: false,
      retryCount: 0,
      latencyMs: 3_000,
      audioDurationMs: 8_000,
      referenceTranscript: "딸과 통화",
      hypothesisTranscript: "딸과 통화",
      usableTranscript: true,
      preprocessingVersion: "haru-dc-hp80-rms-v2",
      semanticSlots: [{ slotId: "activity", expectedValues: ["통화"] }],
    },
  ],
};

test("edit metrics are deterministic and empty-reference safe", () => {
  assert.equal(editDistance(["a", "b"], ["a", "c"]), 1);
  assert.equal(characterErrorRate("가나다", "가다"), 1 / 3);
  assert.equal(wordErrorRate("오늘 공원 산책", "오늘 공원"), 1 / 3);
  assert.equal(characterErrorRate("", ""), 0);
  assert.equal(wordErrorRate("", "추가"), null);
});

test("uses explicit noSpeech when runtime stores STT status as failed", () => {
  const result = analyzeSttReviewRows([
    {
      pairId: "PAIR-FAILED-NO-SPEECH",
      voiceExperienceVariant: "baseline_v1",
      status: "failed",
      noSpeech: true,
      retryCount: 0,
      latencyMs: 1200,
      referenceTranscript: "오늘 산책",
      hypothesisTranscript: "",
      usableTranscript: false,
      preprocessingVersion: "decode-resample-only-v1",
      semanticSlots: [{ slotId: "activity", expectedValues: ["산책"], preserved: false }],
      droppedAtVoiceStep: false,
    },
  ]);
  assert.equal(result.variants[0].noSpeechRate, 1);
  assert.equal(result.variants[0].dropoutRate, 0);
});

test("analyzes paired STT variants and operational dropoff/return", () => {
  const result = analyzeSyntheticPilot(operational, review);

  assert.equal(result.dataset.dataKind, "sample");
  assert.equal(result.dataset.label, "샘플 데이터");
  assert.equal(result.overview.participantCount, 2);
  assert.equal(result.overview.day1Started, 2);
  assert.equal(result.overview.day1Completed, 1);
  assert.equal(result.overview.nextDayReturnRate, 0);
  assert.equal(result.voiceOperational.nextDayReturnEligibleCount, 1);
  assert.equal(result.voiceOperational.nextDayReturnedCount, 0);
  assert.equal(result.voiceOperational.voiceAttemptCount, 2);
  assert.equal(result.voiceOperational.dropoutRate, 0.5);

  assert.deepEqual(result.stt.variants.map((item) => item.variant), ["assist", "baseline"]);
  const assist = result.stt.variants.find((item) => item.variant === "assist");
  const baseline = result.stt.variants.find((item) => item.variant === "baseline");
  assert.equal(assist.usableTranscriptRate, 1);
  assert.equal(assist.semanticSlotPreservationRate, 1);
  assert.equal(assist.noSpeechRate, 0);
  assert.equal(assist.retryRate, 0);
  assert.equal(assist.dropoutRate, 0);
  assert.equal(assist.latencyP50Ms, 2_500);
  assert.equal(assist.latencyP90Ms, 2_900);
  assert.equal(baseline.usableTranscriptRate, 0);
  assert.equal(baseline.noSpeechRate, 0.5);
  assert.equal(baseline.retryRate, 1);
  assert.equal(baseline.dropoutRate, 0.5);
  assert.equal(baseline.semanticSlotPreservationRate, 1 / 3);
  assert.equal(result.stt.paired.usableTranscriptRateDelta, 1);
  assert.equal(result.stt.paired.noSpeechRateDelta, -0.5);
  assert.equal(result.stt.paired.pairCount, 2);
  assert.equal(result.stt.preprocessing.assist, "haru-dc-hp80-rms-v2");
  assert.match(result.stt.metricNotes.humanUsableTranscriptRate, /후속 기억 단서/);
  assert.doesNotMatch(
    result.stt.metricNotes.humanUsableTranscriptRate,
    /합성|시뮬레이션|가상|가정|synthetic|simulation|scenario/i,
  );
});

test("counts next-day return only after a voice-step dropout", () => {
  const result = analyzeSyntheticPilot({
    ...operational,
    participants: [
      ...operational.participants,
      { participantId: "SYN-003", ageBand: "70-79", preferredInputMode: "touch" },
    ],
    routineSessions: [
      ...operational.routineSessions,
      {
        participantId: "SYN-002",
        sessionId: "S2-D2",
        day: 2,
        status: "completed",
      },
      {
        participantId: "SYN-003",
        sessionId: "S3-D2",
        day: 2,
        status: "completed",
      },
    ],
  }, review);

  assert.equal(result.overview.day1Started, 2);
  assert.equal(result.dailyFunnel[1].started, 3);
  assert.equal(result.overview.nextDayReturnRate, 1);
  assert.equal(result.voiceOperational.nextDayReturnEligibleCount, 1);
  assert.equal(result.voiceOperational.nextDayReturnedCount, 1);
  const participant = result.participantMatrix.find((row) => row.participantId === "SYN-002");
  assert.equal(participant.days[1], "returned_after_voice_dropoff");
});

test("rejects non-sample inputs before reading restricted text", () => {
  assert.throws(
    () => analyzeSyntheticPilot({ ...operational, dataKind: "production" }, review),
    /sample/i,
  );
});

test("tolerates missing optional arrays", () => {
  const result = analyzeSyntheticPilot(
    { schemaVersion: "v1", generatedAt: "2026-08-06T00:00:00Z", dataKind: "sample" },
    { dataKind: "sample" },
  );
  assert.equal(result.overview.participantCount, 0);
  assert.equal(result.voiceOperational.voiceAttemptCount, 0);
  assert.equal(result.stt.variants.length, 0);
});

test("pairs matched participants separately for each day and question", () => {
  const rows = [1, 2].flatMap((day) =>
    ["baseline_v1", "assist_v2"].map((voiceExperienceVariant) => ({
      participantId: voiceExperienceVariant === "baseline_v1" ? "SYN-001" : "SYN-002",
      pairId: "PAIR-01",
      voiceExperienceVariant,
      day,
      questionId: `D${day}_Q6`,
      referenceTranscript: "공원 산책",
      hypothesisTranscript: "공원 산책",
      usableTranscript: true,
      noSpeech: false,
      retryCount: 0,
      latencyMs: 1000,
      semanticSlots: [{ slotId: "activity", expectedValues: ["산책"], preserved: true }],
    })),
  );
  assert.equal(analyzeSttReviewRows(rows).paired.pairCount, 2);
});
