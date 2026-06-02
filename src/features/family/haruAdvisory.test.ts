import { describe, expect, it } from "vitest";
import type { RoutineResult } from "../cognitive/cognitiveRoutineStorage";
import type { MemoryCard } from "../memory/types";
import type { CaregiverObservationRecord } from "./caregiverObservationStorage";
import { generateHaruAdvisorySummary } from "./haruAdvisory";

describe("generateHaruAdvisorySummary", () => {
  const now = new Date("2026-01-15T12:00:00.000Z");

  const baseMemoryCard: MemoryCard = {
    id: "memory_1",
    userId: "local_user",
    createdAt: "2026-01-10T09:00:00.000Z",
    updatedAt: "2026-01-10T09:00:00.000Z",
    source: "daily_lesson",
    sensitivity: "personal",
    shareWithFamily: true,
    textSummary: "shared walk",
    reviewState: {
      dueAt: "2026-01-15T09:00:00.000Z",
      intervalDays: 2,
      ease: 2.4,
      reviewCount: 2,
    },
  };

  it("returns a steady limited summary when there is not enough signal data", () => {
    const summary = generateHaruAdvisorySummary([], [], [], now);

    expect(summary.level).toBe("steady");
    expect(summary.dataCompleteness).toBe("limited");
    expect(summary.signals).toEqual([]);
    expect(summary.summary.key).toBe("family.advisory.summary.steady");
  });

  it("combines routine metadata and caregiver observations into explainable support signals", () => {
    const routineResults: RoutineResult[] = [
      {
        id: "previous_1",
        type: "attention_pattern",
        timestamp: "2026-01-04T09:00:00.000Z",
        completed: true,
      },
      {
        id: "previous_2",
        type: "attention_pattern",
        timestamp: "2026-01-05T09:00:00.000Z",
        completed: true,
      },
      {
        id: "previous_3",
        type: "attention_pattern",
        timestamp: "2026-01-06T09:00:00.000Z",
        completed: true,
      },
      {
        id: "word",
        type: "delayed_word_recall",
        timestamp: "2026-01-14T09:00:00.000Z",
        completed: true,
        metadata: { correctCount: 1, targetCount: 5 },
      },
      {
        id: "trail",
        type: "trail_switching_practice",
        timestamp: "2026-01-14T10:00:00.000Z",
        completed: true,
        metadata: { errorCount: 3 },
      },
    ];
    const observationRecords: CaregiverObservationRecord[] = [
      {
        id: "obs",
        createdAt: "2026-01-14T20:00:00.000Z",
        selectedDomains: ["appointments", "homeSafety"],
        domainResponses: {
          appointments: "oftenDifferent",
          homeSafety: "occasionallyDifferent",
        },
        note: "Needs more concrete reminders.",
      },
    ];

    const summary = generateHaruAdvisorySummary(
      [baseMemoryCard],
      routineResults,
      observationRecords,
      now,
    );

    expect(summary.level).toBe("needsConversation");
    expect(summary.signals.map((signal) => signal.key)).toEqual(
      expect.arrayContaining([
        "family.advisory.signals.wordRecallLow",
        "family.advisory.signals.trailErrors",
        "family.advisory.signals.observationChanged",
      ]),
    );
    expect(summary.domainSummaries).toContainEqual(
      expect.objectContaining({
        domain: "memory",
        level: "needsConversation",
      }),
    );
    expect(summary.nextSteps.map((step) => step.key)).toEqual(
      expect.arrayContaining([
        "family.advisory.nextSteps.prepareConversation",
        "family.advisory.nextSteps.professionalConversation",
      ]),
    );
    expect(JSON.stringify(summary)).not.toMatch(/diagnosis|dementia|score|MMSE|MoCA/i);
  });

  it("marks data completeness as rich when repeated routines and observations are available", () => {
    const routineResults: RoutineResult[] = Array.from({ length: 22 }, (_, index) => ({
      id: `routine_${index}`,
      type: "orientation_practice",
      timestamp: new Date(now.getTime() - index * 24 * 60 * 60 * 1000).toISOString(),
      completed: true,
      metadata: { matchedExpected: true },
    }));
    const observationRecords: CaregiverObservationRecord[] = [
      {
        id: "obs_1",
        createdAt: "2026-01-12T20:00:00.000Z",
        selectedDomains: ["dailyRoutine"],
        domainResponses: { dailyRoutine: "aboutSame" },
        note: "",
      },
    ];

    const summary = generateHaruAdvisorySummary(
      [baseMemoryCard, { ...baseMemoryCard, id: "memory_2" }],
      routineResults,
      observationRecords,
      now,
    );

    expect(summary.dataCompleteness).toBe("rich");
    expect(summary.level).toBe("steady");
  });
});
