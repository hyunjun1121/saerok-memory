import { describe, expect, it } from "vitest";
import {
  HARU_DEMO_PERSONA,
  HARU_WEEK_PLAN,
  HARU_WEEK_QUESTION_META,
  getHaruWeekPlan,
  haru7DayExercises,
  type HaruWeekDay,
} from "@/data/haru7DayExercises";
import { getLocalizedText, type LocalizedText } from "@/utils/localizedText";

const LANGUAGES = ["ko", "ja", "en"] as const;

function expectCompleteLocalization(value: LocalizedText | undefined): void {
  expect(value).toBeDefined();
  expect(typeof value).toBe("object");

  const localized = value as Partial<Record<(typeof LANGUAGES)[number], string>>;
  for (const language of LANGUAGES) {
    expect(localized[language]?.trim().length).toBeGreaterThan(0);
  }
}

describe("haru7DayExercises", () => {
  it("contains 42 unique exercises and seven six-question day plans", () => {
    expect(haru7DayExercises).toHaveLength(42);
    expect(new Set(haru7DayExercises.map((exercise) => exercise.id)).size).toBe(42);
    expect(HARU_WEEK_QUESTION_META).toHaveLength(42);
    expect(HARU_WEEK_PLAN).toHaveLength(7);

    const exerciseIds = new Set(haru7DayExercises.map((exercise) => exercise.id));
    const metadataIds = new Set(HARU_WEEK_QUESTION_META.map((item) => item.exerciseId));

    for (const plan of HARU_WEEK_PLAN) {
      expect(plan.exerciseIds).toHaveLength(6);
      expect(getHaruWeekPlan(plan.day)).toBe(plan);
      expect(plan.exerciseIds.every((id) => exerciseIds.has(id))).toBe(true);
      expect(plan.exerciseIds.every((id) => metadataIds.has(id))).toBe(true);

      const orderedMetadataIds = HARU_WEEK_QUESTION_META
        .filter((item) => item.day === plan.day)
        .sort((left, right) => left.order - right.order)
        .map((item) => item.exerciseId);
      expect(orderedMetadataIds).toEqual([...plan.exerciseIds]);
    }
  });

  it("resolves separate Korean and Japanese synthetic-week dates", () => {
    expect(HARU_WEEK_PLAN.map((plan) => plan.dateISO)).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
      "2026-07-26",
    ]);
    expect(HARU_WEEK_PLAN.map((plan) => plan.dateISOByMarket.jp)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
    expect(getHaruWeekPlan(1, "jp").dateISO).toBe("2026-07-27");
    expect(getHaruWeekPlan(1, "kr").dateISO).toBe("2026-07-20");
  });

  it("keeps four scored and two unscored questions per day", () => {
    for (const day of [1, 2, 3, 4, 5, 6, 7] as const) {
      const questions = HARU_WEEK_QUESTION_META.filter((item) => item.day === day);

      expect(questions).toHaveLength(6);
      expect(questions.filter((item) => item.scored)).toHaveLength(4);
      expect(questions.filter((item) => !item.scored)).toHaveLength(2);
      expect(questions.map((item) => item.order)).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it("includes one bounded story voice question per day", () => {
    for (const day of [1, 2, 3, 4, 5, 6, 7] as const) {
      const voiceMetadata = HARU_WEEK_QUESTION_META.filter(
        (item) => item.day === day && item.responseType === "voice",
      );
      expect(voiceMetadata).toHaveLength(1);

      const expectedSeconds = day === 7 ? 30 : 25;
      expect(voiceMetadata[0].maxResponseSeconds).toBe(expectedSeconds);

      const exercise = haru7DayExercises.find(
        (candidate) => candidate.id === voiceMetadata[0].exerciseId,
      );
      expect(exercise?.type).toBe("personal_memory_recall");
      expect(exercise?.payload.memoryField).toBe("story");
      expect(exercise?.payload.linkedConceptId).toBe(`haru_week_day_${day}`);
      expect(exercise?.payload.durationSeconds).toBe(expectedSeconds);
    }
  });

  it("keeps every single-choice question to four localized options", () => {
    const selectionMetadata = HARU_WEEK_QUESTION_META.filter(
      (item) => item.responseType === "single_choice",
    );

    expect(selectionMetadata).toHaveLength(33);
    for (const metadata of selectionMetadata) {
      const exercise = haru7DayExercises.find(
        (candidate) => candidate.id === metadata.exerciseId,
      );
      expect(exercise?.payload.options).toHaveLength(4);
      for (const answer of exercise?.payload.options ?? []) {
        expectCompleteLocalization(answer.label);
      }
    }
  });

  it("models sequence questions with the canonical A-D button layout", () => {
    const sequenceMetadata = HARU_WEEK_QUESTION_META.filter(
      (item) => item.responseType === "button_sequence",
    );

    expect(sequenceMetadata).toHaveLength(2);
    for (const metadata of sequenceMetadata) {
      const exercise = haru7DayExercises.find(
        (candidate) => candidate.id === metadata.exerciseId,
      );
      expect(exercise?.type).toBe("sequence_order");
      expect(exercise?.payload.items).toHaveLength(4);
      expect(exercise?.payload.requiredSelectionCount).toBe(3);
      expect(exercise?.correctAnswer).toHaveLength(3);
      expect(exercise?.payload.items?.map((item) => item.id)).toEqual([
        "A",
        "B",
        "C",
        "D",
      ]);
    }
  });

  it("documents scripted sources only from profile data or earlier days", () => {
    const metadataById = new Map(
      HARU_WEEK_QUESTION_META.map((item) => [item.exerciseId, item]),
    );

    for (const item of HARU_WEEK_QUESTION_META) {
      const scriptedSource = item.scriptedSource;
      if (!scriptedSource || scriptedSource.kind === "profile") {
        continue;
      }

      expect(scriptedSource.sourceDay).toBeLessThan(item.day);
      const source = metadataById.get(scriptedSource.sourceQuestionId);
      expect(source).toBeDefined();
      expect(source?.day).toBe(scriptedSource.sourceDay);
    }
  });

  it("provides nonempty Korean, Japanese, and English for all visible data", () => {
    expectCompleteLocalization(HARU_DEMO_PERSONA.displayName);
    expectCompleteLocalization(HARU_DEMO_PERSONA.residence);
    expectCompleteLocalization(HARU_DEMO_PERSONA.livingArrangement);
    expectCompleteLocalization(HARU_DEMO_PERSONA.speechProfileNote);
    expectCompleteLocalization(HARU_DEMO_PERSONA.gender);
    for (const field of Object.values(HARU_DEMO_PERSONA.registeredProfileFields)) {
      expectCompleteLocalization(field);
    }

    for (const plan of HARU_WEEK_PLAN) {
      expectCompleteLocalization(plan.weekday);
      expectCompleteLocalization(plan.title);
      expectCompleteLocalization(plan.greeting);
      expectCompleteLocalization(plan.completionMessage);
    }

    for (const exercise of haru7DayExercises) {
      expectCompleteLocalization(exercise.prompt);
      expectCompleteLocalization(exercise.explanation);
      expectCompleteLocalization(exercise.payload.audioText);

      for (const answer of exercise.payload.options ?? []) {
        expectCompleteLocalization(answer.label);
      }
      for (const item of exercise.payload.items ?? []) {
        expectCompleteLocalization(item.label);
      }
    }
  });

  it("uses usable generic instructions and response-safe acknowledgements", () => {
    const genericChoices = haru7DayExercises.filter(
      (exercise) => exercise.type === "multiple_choice_meaning",
    );
    expect(genericChoices.length).toBeGreaterThan(0);
    for (const exercise of genericChoices) {
      expectCompleteLocalization(exercise.payload.instructionText);
    }

    const openResponses = HARU_WEEK_QUESTION_META
      .filter((item) => !item.scored)
      .map((item) => haru7DayExercises.find((exercise) => exercise.id === item.exerciseId));
    for (const exercise of openResponses) {
      expect(getLocalizedText(exercise?.explanation, "ko")).toContain("고마워요");
    }

    const shapeMatch = haru7DayExercises.find((exercise) => exercise.id === "D5_Q5");
    expect(getLocalizedText(shapeMatch?.prompt, "ko")).toBe(
      "위에 보이는 모양과 똑같은 것을 고르세요.",
    );
    expect(
      getLocalizedText(
        shapeMatch?.payload.options?.find((option) => option.id === "A")
          ?.label,
        "ko",
      ),
    ).toBe("● ▲");
    expect(getLocalizedText(HARU_WEEK_PLAN[3].completionMessage, "ko")).toBe(
      "오늘 활동을 모두 마쳤어요. 한 문제는 틀려도 괜찮아요. 내일 또 만나요.",
    );
  });

  it("exports a sanitized synthetic persona without family-sharing consent", () => {
    expect(HARU_DEMO_PERSONA.isSynthetic).toBe(true);
    expect(HARU_DEMO_PERSONA.contentMode).toBe("scripted_synthetic_week");
    expect(HARU_DEMO_PERSONA.hasFamilySharingConsent).toBe(false);
    expect(HARU_DEMO_PERSONA.consents).toEqual({
      voiceRecording: true,
      sttProcessing: true,
      longitudinalUsageStorage: true,
      personalizedQuestionUse: true,
      consentedAt: "2026-07-19T14:00:00+09:00",
    });

    const serialized = JSON.stringify(HARU_DEMO_PERSONA).toLowerCase();
    expect(serialized).not.toContain("transcript");
    expect(serialized).not.toContain("audio/");
    expect(serialized).not.toContain("voice/");
  });

  it("carries the canonical recorded response for every question without raw voice", () => {
    for (const question of HARU_WEEK_QUESTION_META) {
      expect(question.recordedResponse.responseTimeMs).toBeGreaterThan(0);
      expectCompleteLocalization(question.recordedResponse.feedback);
    }

    const dayFourSequence = HARU_WEEK_QUESTION_META.find(
      (question) => question.exerciseId === "D4_Q6",
    );
    expect(dayFourSequence?.recordedResponse).toEqual(
      expect.objectContaining({
        submittedSequence: ["A", "B", "D"],
        isCorrect: false,
        responseTimeMs: 8200,
      }),
    );

    const serialized = JSON.stringify(HARU_WEEK_QUESTION_META).toLowerCase();
    expect(serialized).not.toContain("transcript");
    expect(serialized).not.toContain("audio_storage");
    expect(serialized).not.toContain("object_key");
  });

  it("returns Monday as the safe fallback for an invalid runtime day", () => {
    expect(getHaruWeekPlan(0 as HaruWeekDay).day).toBe(1);
  });
});
