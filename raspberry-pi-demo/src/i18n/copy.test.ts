import { HARU_WEEK_PLAN, haru7DayExercises } from "@/data/haru7DayExercises";
import { getAllUiCopyValues, getUiCopy, type OfflineLanguage } from "@/i18n/copy";
import { getLocalizedText } from "@/utils/localizedText";

describe("offline UI copy", () => {
  it("provides coherent Korean and Japanese strings", () => {
    expect(getUiCopy("ko", "voiceRecording")).toBe("말씀을 듣고 있어요");
    expect(getUiCopy("ja", "voiceRecording")).toBe("お話を聞いています");
    expect(getUiCopy("ja", "day", { day: 3 })).toBe("3日目");
  });

  it("does not imply that offline voice content is retained", () => {
    expect(getUiCopy("ko", "voiceReviewBody")).toContain("확정");
    expect(getUiCopy("ko", "voiceReviewBody")).not.toContain("남기");
    expect(getUiCopy("ja", "voiceReviewBody")).toContain("確定");
    expect(getUiCopy("ja", "voiceReviewBody")).not.toContain("残す");

    const koreanVoiceAcknowledgements = haru7DayExercises
      .filter((exercise) => exercise.payload.memoryField === "story")
      .map((exercise) => getLocalizedText(exercise.explanation, "ko"));
    expect(koreanVoiceAcknowledgements).not.toContain("오늘 이야기를 남겨주셔서 고마워요.");
  });

  it("does not expose learner-facing clinical wording", () => {
    for (const language of ["ko", "ja"] satisfies OfflineLanguage[]) {
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
      } else {
        expect(joined).not.toMatch(/診断|スクリーニング|検査|リスク|スコア/);
      }
    }
  });
});
