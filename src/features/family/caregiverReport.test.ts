import { describe, expect, it } from "vitest";
import type { MemoryCard } from "@/features/memory/types";
import type { RoutineResult } from "@/features/cognitive/cognitiveRoutineStorage";
import type { CaregiverObservationRecord } from "@/features/family/caregiverObservationStorage";
import { generateCaregiverCounselorReport } from "@/features/family/caregiverReport";

describe("generateCaregiverCounselorReport", () => {
  const baseCard: MemoryCard = {
    id: "base",
    userId: "local_user",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    source: "daily_lesson",
    sensitivity: "personal",
    shareWithFamily: false,
    reviewState: {
      dueAt: "2026-01-01T00:00:00.000Z",
      intervalDays: 1,
      ease: 2.5,
      reviewCount: 1,
    },
  };

  it("builds overview with due-memory and shareable counts", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const memoryCards: MemoryCard[] = [
      {
        ...baseCard,
        id: "m1",
        shareWithFamily: true,
        reviewState: { ...baseCard.reviewState, dueAt: "2026-01-10T00:00:00.000Z" },
      },
      {
        ...baseCard,
        id: "m2",
        shareWithFamily: false,
        reviewState: { ...baseCard.reviewState, dueAt: "2026-01-20T00:00:00.000Z" },
      },
      {
        ...baseCard,
        id: "m3",
        shareWithFamily: false,
        reviewState: { ...baseCard.reviewState, dueAt: "2026-01-14T10:00:00.000Z" },
      },
    ];

    const routineResults: RoutineResult[] = [];

    const report = generateCaregiverCounselorReport(memoryCards, routineResults, now);

    expect(report.overview.totalMemoryCards).toBe(3);
    expect(report.overview.dueMemoryCount).toBe(2);
    expect(report.overview.shareableMemoryCount).toBe(1);
    expect(report.dueMemoryCount).toBe(2);
    expect(report.shareableMemoryCount).toBe(1);
    expect(report.overview.metrics).toEqual(
      expect.arrayContaining([
        { key: "family.dueMemoryCards", values: { count: 2 } },
        { key: "family.sharedMemoryCards", values: { count: 1 } },
      ])
    );
  });

  it("compares routine participation between recent and previous windows", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const routineResults: RoutineResult[] = [
      {
        id: "r1",
        type: "attention_pattern",
        timestamp: "2026-01-14T10:00:00.000Z",
        completed: true,
      },
      {
        id: "r2",
        type: "shape_copy_practice",
        timestamp: "2026-01-14T08:00:00.000Z",
        completed: false,
      },
      {
        id: "r3",
        type: "speech_repeat_practice",
        timestamp: "2026-01-07T10:00:00.000Z",
        completed: true,
      },
      {
        id: "r4",
        type: "delayed_word_recall",
        timestamp: "2026-01-16T10:00:00.000Z",
        completed: true,
      },
    ];

    const report = generateCaregiverCounselorReport([], routineResults, now);

    expect(report.routineTrend.attemptedThisWindow).toBe(2);
    expect(report.routineTrend.completedThisWindow).toBe(1);
    expect(report.routineTrend.attemptedPreviousWindow).toBe(1);
    expect(report.routineTrend.completedPreviousWindow).toBe(1);
    expect(report.routineTrend.trendDirection).toBe("up");
    expect(report.routineTrend.trendSummaryCopy.key).toBe("family.report.routineTrendUp");
    expect(report.overview.completionRate).toBeCloseTo(3 / 4);
    expect(report.overview.lastPracticeDate).toBe("2026-01-14T10:00:00.000Z");
  });

  it("builds activity highlights from recent routine metadata without diagnostic labels", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const routineResults: RoutineResult[] = [
      {
        id: "r1",
        type: "verbal_fluency_practice",
        timestamp: "2026-01-14T10:00:00.000Z",
        completed: true,
        metadata: { uniqueCount: 11 },
      },
      {
        id: "r2",
        type: "trail_switching_practice",
        timestamp: "2026-01-14T11:00:00.000Z",
        completed: true,
        metadata: { errorCount: 1 },
      },
      {
        id: "r3",
        type: "shape_copy_practice",
        timestamp: "2026-01-14T12:00:00.000Z",
        completed: true,
        metadata: { strokeCount: 3, drawingDurationMs: 21000 },
      },
      {
        id: "r4",
        type: "orientation_practice",
        timestamp: "2026-01-14T13:00:00.000Z",
        completed: true,
        metadata: { matchedExpected: true },
      },
      {
        id: "r5",
        type: "stroop_touch_practice",
        timestamp: "2026-01-14T14:00:00.000Z",
        completed: true,
        metadata: { correctCount: 3, errorCount: 1, averageResponseMs: 1420 },
      },
    ];

    const report = generateCaregiverCounselorReport([], routineResults, now);
    const keys = report.activityHighlights.map((item) => item.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        "family.report.activityHighlights.verbalFluency",
        "family.report.activityHighlights.trail",
        "family.report.activityHighlights.stroop",
        "family.report.activityHighlights.drawing",
        "family.report.activityHighlights.orientation",
      ]),
    );
    expect(report.activityHighlights).toContainEqual(
      expect.objectContaining({
        key: "family.report.activityHighlights.drawing",
        values: expect.objectContaining({
          strokeCount: 3,
          seconds: 21,
        }),
      }),
    );
    expect(report.activityHighlights).toContainEqual(
      expect.objectContaining({
        key: "family.report.activityHighlights.stroop",
        values: expect.objectContaining({
          correctCount: 3,
          errorCount: 1,
          averageSeconds: 1.4,
        }),
      }),
    );
  });

  it("derives conversation cues from shareable memory fields", () => {
    const memoryCards: MemoryCard[] = [
      {
        ...baseCard,
        id: "m1",
        shareWithFamily: true,
        textSummary: "walk in the park",
        emotionTag: "calm",
        peopleTags: ["daughter"],
        placeTag: "lake",
      },
      {
        ...baseCard,
        id: "m2",
        shareWithFamily: false,
        textSummary: "private entry",
      },
    ];

    const report = generateCaregiverCounselorReport(memoryCards, [], new Date("2026-01-15T12:00:00.000Z"));

    const keys = report.conversationCues.map((c) => c.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "family.cues.askSummary",
        "family.cues.askEmotion",
        "family.cues.askPeople",
        "family.cues.askPlace",
      ])
    );
    expect(report.conversationCues).toContainEqual(
      expect.objectContaining({
        key: "family.cues.askSummary",
        values: expect.objectContaining({
          summary: "walk in the park",
        }),
      })
    );
  });

  it("returns fallback cues and starter guidance without shareable memories", () => {
    const memoryCards: MemoryCard[] = [
      {
        ...baseCard,
        id: "m1",
        shareWithFamily: false,
      },
    ];

    const report = generateCaregiverCounselorReport(memoryCards, [], new Date("2026-01-15T12:00:00.000Z"));

    const cueKeys = report.conversationCues.map((item) => item.key);
    expect(cueKeys).toEqual([
      "family.cues.fallbackEasiest",
      "family.cues.fallbackTomorrow",
    ]);
    expect(report.strengths).toEqual([
      expect.objectContaining({ key: "family.report.strengths.gentleStart" }),
    ]);
    expect(report.suggestedNextConversationTopics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "family.report.nextTopics.shareableSeed" }),
      ]),
    );
    expect(report.safetyDisclaimerCopyKeys).toEqual(
      expect.arrayContaining([
        "family.counselorDisclaimer",
        "family.privacyBody",
        "exercise.memory.story.privacy",
      ])
    );
  });

  it("turns recent caregiver observation domains into next conversation topics without risk labels", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const observationRecords: CaregiverObservationRecord[] = [
      {
        id: "obs_recent",
        createdAt: "2026-01-14T08:00:00.000Z",
        selectedDomains: ["appointments", "conversation", "dailyRoutine"],
        domainResponses: {
          appointments: "oftenDifferent",
          conversation: "notSure",
          dailyRoutine: "aboutSame",
        },
        note: "Appointments need more reminders.",
      },
      {
        id: "obs_old",
        createdAt: "2026-01-05T08:00:00.000Z",
        selectedDomains: ["moodSocial"],
        domainResponses: {
          moodSocial: "occasionallyDifferent",
        },
        note: "Older note.",
      },
    ];

    const report = generateCaregiverCounselorReport([], [], now, observationRecords);
    const keys = report.suggestedNextConversationTopics.map((item) => item.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        "family.report.nextTopics.observationAppointments",
        "family.report.nextTopics.observationUncertain",
        "family.report.nextTopics.shareableSeed",
      ]),
    );
    expect(keys).not.toContain("family.report.nextTopics.observationDailyRoutine");
    expect(JSON.stringify(report)).not.toMatch(/diagnosis|dementia|risk|score/i);
  });
});

