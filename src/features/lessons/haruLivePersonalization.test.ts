import { describe, expect, it } from "vitest";
import {
  HARU_WEEK_QUESTION_META,
  haru7DayExercises,
  type HaruWeekDay,
} from "@/data/haru7DayExercises";
import type {
  HaruDemoResponse,
  HaruDemoSession,
} from "@/features/lessons/haruDemoSessionStorage";
import {
  resolveHaruExercise,
} from "@/features/lessons/haruLivePersonalization";
import type { HaruDerivedAnnotation } from "@/features/lessons/haruResponseFacts";
import { getLocalizedText } from "@/utils/localizedText";

function exerciseById(id: string) {
  const exercise = haru7DayExercises.find((candidate) => candidate.id === id);
  if (!exercise) throw new Error(`Missing Haru exercise ${id}`);
  return exercise;
}

function choiceResponse(
  questionId: string,
  selectedOptionId: string,
): HaruDemoResponse {
  return {
    questionId,
    responseType: "single_choice",
    selectedOptionId,
    responseTimeMs: 1_000,
    isCorrect: null,
  };
}

function voiceResponse(
  questionId: string,
  derivedAnnotations: HaruDerivedAnnotation[],
): HaruDemoResponse {
  return {
    questionId,
    responseType: "voice",
    responseTimeMs: 1_000,
    isCorrect: null,
    voiceDurationSeconds: 10,
    sttStatus: "completed",
    derivedAnnotations,
  };
}

function completedSession(
  day: HaruWeekDay,
  responses: HaruDemoResponse[],
): HaruDemoSession {
  const date = String(19 + day).padStart(2, "0");
  return {
    day,
    status: "completed",
    questionIds: responses.map((response) => response.questionId),
    questionCount: responses.length,
    startedAt: `2026-07-${date}T01:00:00.000Z`,
    endedAt: `2026-07-${date}T01:01:00.000Z`,
    durationSeconds: 60,
    completionMessage: "완료",
    responses,
  };
}

const canonicalSessions = (): HaruDemoSession[] => [
  completedSession(1, [
    choiceResponse("D1_Q1", "B"),
    voiceResponse("D1_Q5", [
      { entityType: "장소", value: "유성시장" },
      { entityType: "구매물품", value: "애호박" },
      { entityType: "구매물품", value: "대파" },
    ]),
  ]),
  completedSession(2, [
    choiceResponse("D2_Q1", "A"),
    voiceResponse("D2_Q6", [
      { entityType: "장소", value: "복지관" },
      { entityType: "인물", value: "친구 이순자" },
      { entityType: "활동", value: "윷놀이" },
    ]),
  ]),
  completedSession(3, [
    voiceResponse("D3_Q6", [
      { entityType: "장소", value: "유성구 보건소" },
      { entityType: "활동", value: "혈압 측정" },
      { entityType: "신체상태", value: "조금 피곤함" },
      { entityType: "감정", value: "편안함" },
    ]),
  ]),
  completedSession(4, [
    voiceResponse("D4_Q5", [
      { entityType: "음료", value: "보리차" },
      { entityType: "신체상태", value: "몸이 가벼워짐" },
    ]),
  ]),
  completedSession(5, [
    voiceResponse("D5_Q6", [
      { entityType: "인물", value: "딸 김민지" },
      { entityType: "인물", value: "손자 김준호" },
      { entityType: "음식", value: "김치전" },
      { entityType: "감정", value: "반가움" },
    ]),
  ]),
  completedSession(6, [
    voiceResponse("D6_Q6", [
      { entityType: "장소", value: "빵집" },
      { entityType: "구매물품", value: "단팥빵" },
      { entityType: "수량", value: "2개" },
      { entityType: "활동", value: "오후에 집에서 휴식" },
    ]),
  ]),
];

describe("haruLivePersonalization", () => {
  it("uses a neutral D2_Q3 fallback when its prior source is unavailable", () => {
    const resolved = resolveHaruExercise(exerciseById("D2_Q3"), []);
    const serialized = JSON.stringify(resolved.exercise);

    expect(resolved.personalization).toEqual({
      kind: "fallback",
      sourceQuestionIds: ["D1_Q5"],
    });
    expect(serialized).not.toContain("유성시장");
    expect(serialized).not.toContain("애호박");
    expect(resolved.exercise.correctAnswer).toBeNull();
  });

  it("builds D2_Q3 from the completed D1 voice facts without a stale duplicate", () => {
    const sessions = [
      completedSession(1, [
        voiceResponse("D1_Q5", [
          { entityType: "장소", value: "유성시장" },
          { entityType: "구매물품", value: "가지" },
        ]),
      ]),
    ];
    const resolved = resolveHaruExercise(exerciseById("D2_Q3"), sessions);
    const prompt = getLocalizedText(resolved.exercise.prompt, "ko");
    const labels = (resolved.exercise.payload.options ?? []).map((option) =>
      getLocalizedText(option.label, "ko"),
    );
    const correct = resolved.exercise.payload.options?.find(
      (option) => option.id === resolved.exercise.correctAnswer,
    );

    expect(resolved.personalization).toEqual({
      kind: "prior_response",
      sourceQuestionIds: ["D1_Q5"],
    });
    expect(prompt).toContain("유성시장");
    expect(prompt).not.toContain("애호박");
    expect(getLocalizedText(correct?.label, "ko")).toBe("가지");
    expect(labels.filter((label) => label === "가지")).toHaveLength(1);
    expect(labels).not.toContain("애호박");
  });

  it("returns the exact canonical exercise object for canonical typed facts", () => {
    const exercise = exerciseById("D2_Q3");
    const sessions = [
      completedSession(1, [
        voiceResponse("D1_Q5", [
          { entityType: "장소", value: "유성시장" },
          { entityType: "구매물품", value: "애호박" },
        ]),
      ]),
    ];

    const resolved = resolveHaruExercise(exercise, sessions);

    expect(resolved.exercise).toBe(exercise);
    expect(resolved.personalization).toEqual({
      kind: "prior_response",
      sourceQuestionIds: ["D1_Q5"],
    });
  });

  it("uses the changed D1 mood in D2_Q1", () => {
    const sessions = [completedSession(1, [choiceResponse("D1_Q1", "A")])];
    const resolved = resolveHaruExercise(exerciseById("D2_Q1"), sessions);

    expect(getLocalizedText(resolved.exercise.prompt, "ko")).toContain("매우 좋음");
    expect(resolved.personalization).toEqual({
      kind: "prior_response",
      sourceQuestionIds: ["D1_Q1"],
    });
  });

  it("resolves provenance for all four profile and fourteen prior-response questions", () => {
    const sessions = canonicalSessions();
    const scriptedQuestions = HARU_WEEK_QUESTION_META.filter(
      (question) => question.scriptedSource,
    );
    const profileQuestions = scriptedQuestions.filter(
      (question) => question.scriptedSource?.kind === "profile",
    );
    const priorQuestions = scriptedQuestions.filter(
      (question) => question.scriptedSource?.kind === "prior_question",
    );

    expect(scriptedQuestions).toHaveLength(18);
    expect(profileQuestions).toHaveLength(4);
    expect(priorQuestions).toHaveLength(14);

    for (const question of scriptedQuestions) {
      const source = question.scriptedSource;
      const resolved = resolveHaruExercise(exerciseById(question.exerciseId), sessions);
      if (source?.kind === "profile") {
        expect(resolved.personalization, question.exerciseId).toEqual({ kind: "profile" });
      } else if (source?.kind === "prior_question") {
        expect(resolved.personalization, question.exerciseId).toEqual({
          kind: "prior_response",
          sourceQuestionIds: [source.sourceQuestionId],
        });
      }
    }
  });

  it("makes four the correct remainder when D7_Q5 receives a quantity of five", () => {
    const sessions = [
      completedSession(6, [
        voiceResponse("D6_Q6", [
          { entityType: "구매물품", value: "단팥빵" },
          { entityType: "수량", value: "5개" },
        ]),
      ]),
    ];
    const resolved = resolveHaruExercise(exerciseById("D7_Q5"), sessions);
    const options = resolved.exercise.payload.options ?? [];
    const correct = options.find((option) => option.id === resolved.exercise.correctAnswer);

    expect(options).toHaveLength(4);
    expect(getLocalizedText(resolved.exercise.prompt, "ko")).toContain("5개");
    expect(getLocalizedText(correct?.label, "ko")).toBe("4개");
    expect(resolved.personalization).toEqual({
      kind: "prior_response",
      sourceQuestionIds: ["D6_Q6"],
    });
  });
});
