import test from "node:test";
import assert from "node:assert/strict";

import {
  renderDashboardHtml,
  renderFindingsMarkdown,
  renderMethodologyMarkdown,
  renderStaticCharts,
} from "./dashboard-render.mjs";

const analysis = {
  schemaVersion: "haru-voice-pilot-sample-analysis-v1",
  generatedAt: "2026-08-06T00:00:00.000Z",
  seed: 17,
  dataset: {
    dataKind: "sample",
    label: "샘플 데이터",
    containsRestrictedText: false,
    containsAudioFiles: false,
  },
  overview: {
    participantCount: 20,
    day1Started: 19,
    day1Completed: 17,
    day7Started: 12,
    day7Completed: 10,
    fullWeekCompletedParticipantCount: 8,
    nextDayReturnRate: 0.84,
    totalSessionRows: 110,
    totalQuestionAttempts: 580,
  },
  dailyFunnel: Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    eligible: 20,
    started: 19 - index,
    completed: 17 - index,
    partialOrExited: 2,
    observedDropoff: index === 3 ? 2 : 1,
    absent: 1 + index,
    startRate: (19 - index) / 20,
    completionRateAmongStarted: (17 - index) / (19 - index),
    returnFromPreviousDayRate: index === 0 ? null : (19 - index) / (20 - index),
  })),
  participantMatrix: Array.from({ length: 20 }, (_, index) => ({
    participantId: `SYN-${String(index + 1).padStart(3, "0")}`,
    days: Array.from({ length: 7 }, (_, day) => (day < 7 - (index % 4) ? "completed" : "absent")),
  })),
  questionMetrics: [
    {
      questionId: "D4_Q5",
      questionType: "voice",
      day: 4,
      ordinal: 5,
      presented: 17,
      completed: 13,
      completionRate: 13 / 17,
      dropouts: 4,
      dropoutRate: 4 / 17,
      retryRate: 3 / 17,
      invalidRate: 2 / 17,
      activeDurationP50Ms: 18_000,
      activeDurationP90Ms: 31_000,
      wallMinusActiveP50Ms: 4_000,
    },
  ],
  dropoutHotspots: [
    {
      questionId: "D4_Q5",
      questionType: "voice",
      presented: 17,
      dropouts: 4,
      dropoutRate: 4 / 17,
      retryRate: 3 / 17,
      activeDurationP50Ms: 18_000,
    },
  ],
  voiceOperational: {
    voiceAttemptCount: 110,
    completedCount: 95,
    dropoutCount: 15,
    dropoutRate: 15 / 110,
    nextDayReturnEligibleCount: 12,
    nextDayReturnedCount: 10,
    nextDayReturnRate: 10 / 12,
  },
  cohorts: { ageBand: [], preferredInputMode: [], voiceExperienceVariant: [] },
  stt: {
    primaryMetric: "human_usable_transcript_rate",
    preprocessing: { baseline: "haru-raw-v1", assist: "haru-dc-hp80-rms-v2" },
    paired: {
      pairCount: 55,
      usableTranscriptRateDelta: 0.12,
      noSpeechRateDelta: -0.05,
      retryCountDelta: -0.2,
      latencyMedianDeltaMs: 120,
      characterErrorRateDelta: -0.08,
    },
    variants: [
      {
        variant: "baseline_v1",
        variantKind: "baseline",
        attemptCount: 55,
        usableTranscriptRate: 0.71,
        characterErrorRate: 0.21,
        wordErrorRate: 0.32,
        semanticSlotPreservationRate: 0.74,
        noSpeechRate: 0.11,
        retryRate: 0.22,
        latencyP50Ms: 1800,
        latencyP90Ms: 3200,
        preprocessingVersions: ["haru-raw-v1"],
      },
      {
        variant: "assist_v2",
        variantKind: "assist",
        attemptCount: 55,
        usableTranscriptRate: 0.83,
        characterErrorRate: 0.13,
        wordErrorRate: 0.2,
        semanticSlotPreservationRate: 0.89,
        noSpeechRate: 0.06,
        retryRate: 0.15,
        latencyP50Ms: 1920,
        latencyP90Ms: 3410,
        preprocessingVersions: ["haru-dc-hp80-rms-v2"],
      },
    ],
  },
};

test("renders standalone dashboard focused on sample data and complete chart sections", () => {
  const html = renderDashboardHtml(analysis);
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /샘플 데이터/);
  assert.doesNotMatch(
    html,
    /합성|시뮬레이션|가상|가정|synthetic|simulation|scenario/i,
  );
  assert.match(html, /data-capture="retention"/);
  assert.match(html, /data-capture="participant-week"/);
  assert.match(html, /data-capture="stt-comparison"/);
  assert.match(html, /data-capture="dropoff-hotspots"/);
  assert.match(html, /data-capture="question-timing"/);
  assert.match(html, /data-capture="cohorts"/);
  assert.match(html, /data-capture="assist-intervention"/);
  assert.match(html, /말하는 동안 입력 반응을 바로 확인/);
  assert.match(html, /또박또박 말하려 애쓰지 않아도/);
  assert.match(html, /haru-dc-hp80-rms-v2/);
  assert.doesNotMatch(html, /referenceTranscript|hypothesisTranscript|raw_user_utterance/);
});

test("renders sanitized findings and methodology without provenance-heavy wording", () => {
  const findings = renderFindingsMarkdown(analysis);
  const methodology = renderMethodologyMarkdown(analysis);
  assert.match(findings, /샘플 데이터/);
  assert.match(findings, /83\.0%/);
  assert.match(findings, /assist_v2에 넣은 개선/);
  assert.match(findings, /빨간 파형/);
  assert.match(findings, /사용 가능 전사율/);
  assert.match(methodology, /사용 가능 전사율/);
  assert.match(methodology, /voiceExperienceVariant/);
  assert.match(methodology, /CER/);
  assert.match(methodology, /WER/);
  assert.match(methodology, /n < 3/);
  assert.match(methodology, /음성 단계에서 이탈한 참여자-일/);
  for (const output of [findings, methodology]) {
    assert.doesNotMatch(
      output,
      /합성|시뮬레이션|가상|가정|synthetic|simulation|scenario/i,
    );
  }
});

test("renders presentation-ready static SVG chart inventory", () => {
  const charts = renderStaticCharts(analysis);
  assert.deepEqual(Object.keys(charts).sort(), [
    "01_daily_retention.svg",
    "02_participant_week.svg",
    "03_stt_variant_comparison.svg",
    "04_question_dropoff_hotspots.svg",
    "05_question_timing.svg",
    "06_cohort_completion.svg",
  ]);
  for (const svg of Object.values(charts)) {
    assert.match(svg, /^<svg/);
    assert.match(svg, /샘플 데이터/);
    assert.doesNotMatch(
      svg,
      /합성|시뮬레이션|가상|가정|synthetic|simulation|scenario/i,
    );
    assert.doesNotMatch(svg, /referenceTranscript|hypothesisTranscript/);
  }
});
