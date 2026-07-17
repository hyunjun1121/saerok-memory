import { describe, expect, it } from "vitest";
import {
  HARU_WEEK_PLAN,
  HARU_WEEK_QUESTION_META,
} from "@/data/haru7DayExercises";
import {
  buildHaruParticipant,
  getParticipant,
} from "@/app/connect/counselor/counselorData";
import type {
  HaruDemoResponse,
  HaruDemoSession,
} from "@/features/lessons/haruDemoSessionStorage";
import { getLocalizedText } from "@/utils/localizedText";

function canonicalSessions(): HaruDemoSession[] {
  return HARU_WEEK_PLAN.map((plan) => {
    const responses: HaruDemoResponse[] = HARU_WEEK_QUESTION_META
      .filter((question) => question.day === plan.day)
      .map((question) => ({
        questionId: question.exerciseId,
        responseType: question.responseType,
        responseTimeMs: question.recordedResponse.responseTimeMs,
        isCorrect: question.recordedResponse.isCorrect,
        ...(question.recordedResponse.selectedOptionId
          ? { selectedOptionId: question.recordedResponse.selectedOptionId }
          : {}),
        ...(question.recordedResponse.submittedSequence
          ? { submittedSequence: [...question.recordedResponse.submittedSequence] }
          : {}),
        ...(question.recordedResponse.voiceDurationSeconds !== undefined
          ? { voiceDurationSeconds: question.recordedResponse.voiceDurationSeconds }
          : {}),
        ...(question.recordedResponse.sttStatus
          ? { sttStatus: question.recordedResponse.sttStatus }
          : {}),
      }));

    return {
      day: plan.day,
      status: "completed",
      questionIds: [...plan.exerciseIds],
      questionCount: plan.exerciseIds.length,
      startedAt: `${plan.dateISO}T01:00:00.000Z`,
      endedAt: `${plan.dateISO}T01:02:00.000Z`,
      durationSeconds: plan.recordedSummary.durationSeconds,
      completionMessage: getLocalizedText(plan.completionMessage, "ko"),
      responses,
    };
  });
}

describe("counselorData", () => {
  it("returns a seven-row empty participant without canonical fallback", () => {
    const participant = buildHaruParticipant([]);

    expect(participant).toEqual(
      expect.objectContaining({
        status: "none",
        pct: 0,
        completedSessions: 0,
        expectedSessions: 7,
        activityCount: 0,
        evaluatedActivities: 0,
        expectedMatches: 0,
        voiceRecords: 0,
        profileBasedQuestions: 0,
        priorResponseQuestions: 0,
        moodResponses: 0,
        priorRecallResponses: 0,
        sequenceEvaluated: 0,
        sequenceDifferences: 0,
        sttAverageConfidence: null,
        hasLiveRecords: false,
      }),
    );
    expect(participant.dailyRecords).toHaveLength(7);
    expect(participant.dailyRecords.every((record) => record.status === "none")).toBe(true);
    expect(participant.participation).toEqual([false, false, false, false, false, false, false]);
    expect(getParticipant(2, [])).toBeUndefined();
  });

  it("aggregates a partial session and ignores invalid or wrong-day responses", () => {
    const responses = [
      {
        questionId: "D1_Q1",
        responseType: "single_choice",
        selectedOptionId: "B",
        responseTimeMs: 6_000,
        isCorrect: null,
      },
      {
        questionId: "D1_Q2",
        responseType: "single_choice",
        selectedOptionId: "A",
        responseTimeMs: 7_000,
        isCorrect: true,
        personalization: { kind: "prior_response" },
      },
      {
        questionId: "D1_Q3",
        responseType: "single_choice",
        selectedOptionId: "A",
        responseTimeMs: 5_000,
        isCorrect: true,
      },
      {
        questionId: "D2_Q3",
        responseType: "single_choice",
        responseTimeMs: 5_000,
        isCorrect: true,
      },
      {
        questionId: "unknown",
        responseType: "single_choice",
        responseTimeMs: 1,
        isCorrect: true,
      },
      {
        questionId: "D1_Q4",
        responseType: "voice",
        responseTimeMs: 6_000,
        isCorrect: true,
      },
    ] as HaruDemoResponse[];
    const session: HaruDemoSession = {
      day: 1,
      status: "in_progress",
      questionIds: responses.map((response) => response.questionId),
      questionCount: responses.length,
      startedAt: "2026-07-20T01:00:00.000Z",
      endedAt: null,
      durationSeconds: null,
      completionMessage: null,
      responses,
    };

    const participant = buildHaruParticipant([session]);

    expect(participant).toEqual(
      expect.objectContaining({
        status: "partial",
        pct: 0,
        completedSessions: 0,
        activityCount: 3,
        evaluatedActivities: 2,
        expectedMatches: 2,
        profileBasedQuestions: 1,
        priorResponseQuestions: 1,
        moodResponses: 1,
        hasLiveRecords: true,
      }),
    );
    expect(participant.dailyRecords[0]).toEqual(
      expect.objectContaining({
        status: "partial",
        activitiesCompleted: 3,
        evaluatedActivities: 2,
        expectedMatches: 2,
      }),
    );
    expect(participant.dailyRecords.slice(1).every((record) => record.status === "none")).toBe(true);
  });

  it("matches the canonical safe fixture only when all 42 live responses are supplied", () => {
    const participant = buildHaruParticipant(canonicalSessions());
    const practiceEvaluatedTotal = participant.practiceAreas.reduce(
      (sum, area) => sum + area.evaluatedActivities,
      0,
    );
    const practiceMatchedTotal = participant.practiceAreas.reduce(
      (sum, area) => sum + area.expectedMatches,
      0,
    );

    expect(participant).toEqual(
      expect.objectContaining({
        status: "done",
        pct: 100,
        completedSessions: 7,
        activityCount: 42,
        evaluatedActivities: 28,
        expectedMatches: 27,
        voiceRecords: 7,
        profileBasedQuestions: 4,
        priorResponseQuestions: 14,
        moodResponses: 7,
        priorRecallResponses: 6,
        sequenceEvaluated: 2,
        sequenceDifferences: 1,
        sttCompleted: 7,
        sttAverageConfidence: null,
        hasLiveRecords: true,
      }),
    );
    expect(participant.dailyRecords).toHaveLength(7);
    expect(participant.dailyRecords.every((record) => record.status === "done")).toBe(true);
    expect(practiceEvaluatedTotal).toBe(28);
    expect(practiceMatchedTotal).toBe(27);
    expect(participant.averageSessionSeconds).toBeCloseTo(101.86, 2);
    expect(participant.averageChoiceResponseSeconds).toBeCloseTo(6.27, 2);
    expect(participant.averageVoiceDurationSeconds).toBeCloseTo(13.93, 2);
  });

  it("serializes aggregates without private response material", () => {
    const sessions = canonicalSessions();
    const voiceResponse = sessions[0].responses.find(
      (response) => response.responseType === "voice",
    );
    Object.assign(voiceResponse ?? {}, {
      derivedAnnotationValues: ["보건소", "김치전"],
      rawTranscript: "원문 음성 비밀",
      audioObjectKey: "voice/private/D1_Q5.wav",
      options: ["비밀 선택지"],
    });

    const participant = buildHaruParticipant(sessions);
    const serialized = JSON.stringify(participant);

    expect(participant.familySharingConsent).toBe(false);
    expect(participant.shareableMemoryCount).toBe(0);
    expect(serialized).not.toContain("derivedAnnotationValues");
    expect(serialized).not.toContain("보건소");
    expect(serialized).not.toContain("김치전");
    expect(serialized).not.toContain("rawTranscript");
    expect(serialized).not.toContain("원문 음성 비밀");
    expect(serialized).not.toContain("audioObjectKey");
    expect(serialized).not.toContain("voice/private");
    expect(serialized).not.toContain("options");
    expect(serialized).not.toContain("비밀 선택지");
  });
});
