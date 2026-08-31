import { beforeEach, describe, expect, it } from "vitest";
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
import { updateHaruConsent } from "@/features/profile/haruConsentStorage";
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

const KNOWN_CANONICAL_KOREAN_FACT_VALUES = [
  "유성시장",
  "애호박",
  "대파",
  "딸 김민지",
  "복지관",
  "친구 이순자",
  "윷놀이",
  "유성구 보건소",
  "혈압 측정",
  "조금 피곤함",
  "편안함",
  "보리차",
  "몸이 가벼워짐",
  "손자 김준호",
  "김치전",
  "반가움",
  "빵집",
  "단팥빵",
  "2개",
  "오후에 집에서 휴식",
] as const;

function localizedExerciseSurface(
  exercise: ReturnType<typeof exerciseById>,
  language: "ja" | "en",
): string {
  return [
    getLocalizedText(exercise.prompt, language),
    getLocalizedText(exercise.explanation, language),
    ...(exercise.payload.options ?? []).map((option) =>
      getLocalizedText(option.label, language),
    ),
  ].join("\n");
}

describe("haruLivePersonalization", () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

  it("selects natural Korean particles for personalized voice facts", () => {
    const vegetable = resolveHaruExercise(
      exerciseById("D2_Q3"),
      [
        completedSession(1, [
          voiceResponse("D1_Q5", [
            { entityType: "장소", value: "홍천" },
            { entityType: "구매물품", value: "대파" },
          ]),
        ]),
      ],
    ).exercise;
    expect(getLocalizedText(vegetable.explanation, "ko")).toContain("대파라고");
    expect(getLocalizedText(vegetable.explanation, "ko")).not.toContain("대파이라고");

    const companion = resolveHaruExercise(
      exerciseById("D3_Q3"),
      [
        completedSession(2, [
          voiceResponse("D2_Q6", [
            { entityType: "장소", value: "도서관" },
            { entityType: "인물", value: "김유준" },
            { entityType: "활동", value: "책 읽기" },
          ]),
        ]),
      ],
    ).exercise;
    expect(getLocalizedText(companion.prompt, "ko")).toContain("책 읽기를");
    expect(getLocalizedText(companion.explanation, "ko")).toContain("김유준과");

    const drink = resolveHaruExercise(
      exerciseById("D5_Q3"),
      [
        completedSession(4, [
          voiceResponse("D4_Q5", [{ entityType: "음료", value: "오미자차" }]),
        ]),
      ],
    ).exercise;
    expect(getLocalizedText(drink.explanation, "ko")).toContain("오미자차를");
  });

  it.each([
    [
      "D2_Q3",
      1,
      "D1_Q5",
      [
        { entityType: "장소", value: "유성시장" },
        { entityType: "구매물품", value: "대파" },
      ],
    ],
    [
      "D3_Q3",
      2,
      "D2_Q6",
      [
        { entityType: "장소", value: "복지관" },
        { entityType: "인물", value: "딸 김민지" },
        { entityType: "활동", value: "윷놀이" },
      ],
    ],
    [
      "D4_Q1",
      3,
      "D3_Q6",
      [
        { entityType: "신체상태", value: "몸이 가벼워짐" },
        { entityType: "감정", value: "편안함" },
      ],
    ],
    [
      "D4_Q3",
      3,
      "D3_Q6",
      [
        { entityType: "장소", value: "유성구 보건소" },
        { entityType: "활동", value: "윷놀이" },
      ],
    ],
    [
      "D5_Q1",
      4,
      "D4_Q5",
      [{ entityType: "신체상태", value: "조금 피곤함" }],
    ],
    [
      "D5_Q3",
      4,
      "D4_Q5",
      [{ entityType: "음료", value: "抹茶" }],
    ],
    [
      "D6_Q1",
      5,
      "D5_Q6",
      [{ entityType: "감정", value: "편안함" }],
    ],
    [
      "D6_Q3",
      5,
      "D5_Q6",
      [
        { entityType: "인물", value: "친구 이순자" },
        { entityType: "인물", value: "딸 김민지" },
        { entityType: "음식", value: "김치전" },
      ],
    ],
    [
      "D7_Q1",
      6,
      "D6_Q6",
      [{ entityType: "활동", value: "혈압 측정" }],
    ],
    [
      "D7_Q3",
      6,
      "D6_Q6",
      [
        { entityType: "장소", value: "유성시장" },
        { entityType: "구매물품", value: "애호박" },
        { entityType: "수량", value: "2개" },
      ],
    ],
    [
      "D7_Q4",
      5,
      "D5_Q6",
      [
        { entityType: "인물", value: "친구 이순자" },
        { entityType: "인물", value: "손자 김준호" },
        { entityType: "음식", value: "김치전" },
      ],
    ],
    [
      "D7_Q5",
      6,
      "D6_Q6",
      [
        { entityType: "구매물품", value: "단팥빵" },
        { entityType: "수량", value: "5개" },
      ],
    ],
  ] satisfies Array<
    [
      targetId: string,
      sourceDay: HaruWeekDay,
      sourceQuestionId: string,
      facts: HaruDerivedAnnotation[],
    ]
  >)(
    "keeps known Korean canonical facts out of Japanese and English dynamic %s surfaces",
    (targetId, sourceDay, sourceQuestionId, facts) => {
      const sessions = [
        completedSession(sourceDay, [voiceResponse(sourceQuestionId, facts)]),
      ];
      const resolved = resolveHaruExercise(exerciseById(targetId), sessions);

      expect(resolved.personalization.kind).toBe("prior_response");
      for (const language of ["ja", "en"] as const) {
        const surface = localizedExerciseSurface(resolved.exercise, language);
        for (const koreanValue of KNOWN_CANONICAL_KOREAN_FACT_VALUES) {
          expect(surface, `${targetId}/${language} leaked ${koreanValue}`).not.toContain(
            koreanValue,
          );
        }
      }
    },
  );

  it("localizes known facts while preserving arbitrary Japanese voice values", () => {
    const knownSessions = [
      completedSession(1, [
        voiceResponse("D1_Q5", [
          { entityType: "장소", value: "유성시장" },
          { entityType: "구매물품", value: "대파" },
        ]),
      ]),
    ];
    const known = resolveHaruExercise(exerciseById("D2_Q3"), knownSessions).exercise;
    const knownCorrect = known.payload.options?.find(
      (option) => option.id === known.correctAnswer,
    );

    expect(getLocalizedText(known.prompt, "ja")).toContain("儒城市場");
    expect(getLocalizedText(known.prompt, "en")).toContain("Yuseong Market");
    expect(getLocalizedText(knownCorrect?.label, "ja")).toBe("長ねぎ");
    expect(getLocalizedText(knownCorrect?.label, "en")).toBe("Green onions");
    expect(getLocalizedText(known.explanation, "ja")).toContain("長ねぎ");
    expect(getLocalizedText(known.explanation, "en")).toContain("Green onions");

    const japaneseSessions = [
      completedSession(1, [
        voiceResponse("D1_Q5", [
          { entityType: "장소", value: "京都の市場" },
          { entityType: "구매물품", value: "紫いも" },
        ]),
      ]),
    ];
    const japanese = resolveHaruExercise(
      exerciseById("D2_Q3"),
      japaneseSessions,
    ).exercise;
    const japaneseCorrect = japanese.payload.options?.find(
      (option) => option.id === japanese.correctAnswer,
    );

    expect(getLocalizedText(japanese.prompt, "ja")).toContain("京都の市場");
    expect(getLocalizedText(japaneseCorrect?.label, "ja")).toBe("紫いも");
    expect(getLocalizedText(japanese.explanation, "ja")).toContain("紫いも");
  });

  it("localizes arbitrary numeric Korean quantities in Japanese and English", () => {
    const sessions = [
      completedSession(6, [
        voiceResponse("D6_Q6", [
          { entityType: "장소", value: "유성시장" },
          { entityType: "구매물품", value: "애호박" },
          { entityType: "수량", value: "5개" },
        ]),
      ]),
    ];
    const purchase = resolveHaruExercise(exerciseById("D7_Q3"), sessions).exercise;
    const purchaseCorrect = purchase.payload.options?.find(
      (option) => option.id === purchase.correctAnswer,
    );
    const remainder = resolveHaruExercise(exerciseById("D7_Q5"), sessions).exercise;

    expect(getLocalizedText(purchaseCorrect?.label, "ja")).toBe("韓国かぼちゃ5個");
    expect(getLocalizedText(purchaseCorrect?.label, "en")).toBe(
      "5 Korean zucchini",
    );
    expect(localizedExerciseSurface(purchase, "ja")).not.toContain("5개");
    expect(localizedExerciseSurface(purchase, "en")).not.toContain("5개");
    expect(localizedExerciseSurface(remainder, "ja")).not.toContain("5개");
    expect(localizedExerciseSurface(remainder, "en")).not.toContain("5개");
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

  it("falls back instead of using a registered profile when personalization is off", () => {
    updateHaruConsent({ personalizedQuestionUse: false });

    const resolved = resolveHaruExercise(exerciseById("D1_Q3"), []);
    const serialized = JSON.stringify(resolved.exercise);

    expect(resolved.personalization).toEqual({ kind: "fallback" });
    expect(getLocalizedText(resolved.exercise.prompt, "ko")).toBe(
      "지금 가장 편하게 떠오르는 시간은 언제인가요?",
    );
    expect(resolved.exercise.correctAnswer).toBeNull();
    expect(serialized).not.toContain("영자");
    expect(serialized).not.toContain("부산 영도");
  });

  it("falls back instead of using a prior response when personalization is off", () => {
    updateHaruConsent({ personalizedQuestionUse: false });
    const sessions = [completedSession(1, [choiceResponse("D1_Q1", "A")])];

    const resolved = resolveHaruExercise(exerciseById("D2_Q1"), sessions);

    expect(resolved.personalization).toEqual({
      kind: "fallback",
      sourceQuestionIds: ["D1_Q1"],
    });
    expect(getLocalizedText(resolved.exercise.prompt, "ko")).toBe(
      "오늘 기분은 어떠세요?",
    );
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
