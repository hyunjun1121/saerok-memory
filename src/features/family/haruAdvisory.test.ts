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
          // SP-09: two often-different domains form a repeated concern that
          // legitimately reaches needsConversation (a single one would not).
          appointments: "oftenDifferent",
          homeSafety: "oftenDifferent",
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
    // The memory domain reaches needsConversation here because the caregiver
    // observation (appointments often different) also maps to memory. SP-08:
    // a single low word-recall session alone must NOT do this — see the
    // dedicated single-session test below.
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

  it("keeps a single low word-recall session at watch, not needsConversation (SP-08)", () => {
    const routineResults: RoutineResult[] = [
      {
        id: "word_only",
        type: "delayed_word_recall",
        timestamp: "2026-01-14T09:00:00.000Z",
        completed: true,
        metadata: { correctCount: 1, targetCount: 5 },
      },
    ];

    const summary = generateHaruAdvisorySummary([], routineResults, [], now);

    // A single low session is only a gentle watch cue; never an alarm.
    expect(summary.level).toBe("watch");
    expect(summary.signals.map((signal) => signal.key)).toContain(
      "family.advisory.signals.wordRecallLow",
    );
    expect(summary.signals.every((signal) => signal.level !== "needsConversation")).toBe(true);
  });

  it("keeps a single often-different caregiver observation at watch (SP-09)", () => {
    const observationRecords: CaregiverObservationRecord[] = [
      {
        id: "obs_single",
        createdAt: "2026-01-14T20:00:00.000Z",
        selectedDomains: ["appointments"],
        domainResponses: { appointments: "oftenDifferent" },
        note: "",
      },
    ];

    const summary = generateHaruAdvisorySummary([], [], observationRecords, now);

    expect(summary.level).toBe("watch");
    expect(summary.signals.every((signal) => signal.level !== "needsConversation")).toBe(true);
  });

  it("raises to needsConversation only when two domains are often-different (SP-09)", () => {
    const observationRecords: CaregiverObservationRecord[] = [
      {
        id: "obs_repeated",
        createdAt: "2026-01-14T20:00:00.000Z",
        selectedDomains: ["appointments", "navigation"],
        domainResponses: {
          appointments: "oftenDifferent",
          navigation: "oftenDifferent",
        },
        note: "",
      },
    ];

    const summary = generateHaruAdvisorySummary([], [], observationRecords, now);

    expect(summary.level).toBe("needsConversation");
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
