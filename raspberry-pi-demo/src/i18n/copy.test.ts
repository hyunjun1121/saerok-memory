import {
  HARU_DEMO_PERSONA,
  HARU_WEEK_PLAN,
  HARU_WEEK_QUESTION_META,
  haru7DayExercises,
} from "@/data/haru7DayExercises";
import { getAllUiCopyValues, getUiCopy, type OfflineLanguage } from "@/i18n/copy";
import { getLocalizedText } from "@/utils/localizedText";

describe("offline UI copy", () => {
  it("provides coherent Korean, Japanese, and English strings", () => {
    expect(getUiCopy("ko", "voiceRecording")).toBe("말씀을 듣고 있어요");
    expect(getUiCopy("ja", "voiceRecording")).toBe("お話を聞いています");
    expect(getUiCopy("ja", "day", { day: 3 })).toBe("3日目");
    expect(getUiCopy("en", "voiceRecording")).toBe("We're listening");
    expect(getUiCopy("en", "day", { day: 3 })).toBe("Day 3");
  });

  it("does not imply that offline voice content is retained", () => {
    expect(getUiCopy("ko", "voiceReviewBody")).toContain("확정");
    expect(getUiCopy("ko", "voiceReviewBody")).not.toContain("남기");
    expect(getUiCopy("ja", "voiceReviewBody")).toContain("確定");
    expect(getUiCopy("ja", "voiceReviewBody")).not.toContain("残す");
    expect(getUiCopy("en", "voiceReviewBody")).toContain("confirm");
    expect(getUiCopy("en", "voiceReviewBody")).not.toContain("save");

    const koreanVoiceAcknowledgements = haru7DayExercises
      .filter((exercise) => exercise.payload.memoryField === "story")
      .map((exercise) => getLocalizedText(exercise.explanation, "ko"));
    expect(koreanVoiceAcknowledgements).not.toContain("오늘 이야기를 남겨주셔서 고마워요.");
  });

  it("does not expose learner-facing clinical wording", () => {
    for (const language of ["ko", "ja", "en"] satisfies OfflineLanguage[]) {
      const authored = haru7DayExercises.flatMap((exercise) => [
        getLocalizedText(exercise.prompt, language),
        getLocalizedText(exercise.explanation, language),
        ...(exercise.payload.options ?? exercise.payload.items ?? []).map((item) => getLocalizedText(item.label, language)),
      ]);
      const plan = HARU_WEEK_PLAN.flatMap((day) => [
        getLocalizedText(day.title, language),
        getLocalizedText(day.greeting, language),
        getLocalizedText(day.completionMessage, language),
      ]);
      const joined = [...getAllUiCopyValues(language), ...authored, ...plan].join(" ").toLowerCase();
      expect(joined).not.toMatch(/mmse|moca|cist|k-mmse|ad8|gpcog|tics|sage|slums|ace-iii|medical-grade/);
      if (language === "ko") {
        expect(joined).not.toMatch(/검사|스크리닝|선별|진단|위험도|치매 위험|점수/);
      } else if (language === "ja") {
        expect(joined).not.toMatch(/診断|スクリーニング|検査|リスク|スコア/);
      } else {
        expect(joined).not.toMatch(/diagnosis|screening|dementia risk|risk score|medical test/);
      }
    }
  });

  it("keeps all authored English learner copy free of Korean and Japanese fallback text", () => {
    const authored = haru7DayExercises.flatMap((exercise) => [
      getLocalizedText(exercise.prompt, "en"),
      getLocalizedText(exercise.explanation, "en"),
      ...(exercise.payload.options ?? exercise.payload.items ?? []).map((item) => getLocalizedText(item.label, "en")),
    ]);
    const plan = HARU_WEEK_PLAN.flatMap((day) => [
      getLocalizedText(day.title, "en"),
      getLocalizedText(day.greeting, "en"),
      getLocalizedText(day.completionMessage, "en"),
    ]);
    const joined = [...getAllUiCopyValues("en"), ...authored, ...plan].join(" ");

    expect(joined).not.toMatch(/[가-힣ぁ-んァ-ン一-龠々]/u);
  });

  it("uses a coherent U.S. English context instead of transliterated Korean details", () => {
    const authored = haru7DayExercises.flatMap((exercise) => [
      getLocalizedText(exercise.prompt, "en"),
      getLocalizedText(exercise.explanation, "en"),
      ...(exercise.payload.options ?? exercise.payload.items ?? []).map((item) => getLocalizedText(item.label, "en")),
    ]);
    const plan = HARU_WEEK_PLAN.flatMap((day) => [
      getLocalizedText(day.greeting, "en"),
      getLocalizedText(day.completionMessage, "en"),
    ]);
    const recorded = HARU_WEEK_QUESTION_META.flatMap((question) => [
      getLocalizedText(question.personalizationSourceNote, "en"),
      getLocalizedText(question.recordedResponse.feedback, "en"),
    ]);
    const persona = [
      getLocalizedText(HARU_DEMO_PERSONA.name, "en"),
      getLocalizedText(HARU_DEMO_PERSONA.displayName, "en"),
      getLocalizedText(HARU_DEMO_PERSONA.residence, "en"),
      ...Object.values(HARU_DEMO_PERSONA.registeredProfileFields).map((value) => getLocalizedText(value, "en")),
    ];
    const joined = [...getAllUiCopyValues("en"), ...authored, ...plan, ...recorded, ...persona].join(" ");

    expect(joined).toContain("Evelyn");
    expect(joined).toContain("$3");
    expect(joined).toContain("Many hands make light work");
    expect(joined).not.toMatch(
      /\b(?:ms\.?\s+park|youngja|yuseong|busan|daejeon|won|zucchini|yut|kimchi|barley tea|red-bean|minji|junho|soonja|jeonghee)\b/iu,
    );
  });
});
