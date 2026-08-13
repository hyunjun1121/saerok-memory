import { HARU_WEEK_PLAN, haru7DayExercises } from "@/data/haru7DayExercises";
import { getOfflineQuestionsForDay } from "@/features/lesson/questionModel";

describe("offline 7-day question contract", () => {
  it("keeps the authored 7 days and all 42 questions", () => {
    expect(HARU_WEEK_PLAN).toHaveLength(7);
    expect(haru7DayExercises).toHaveLength(42);
    for (let day = 1; day <= 7; day += 1) {
      expect(getOfflineQuestionsForDay(day as 1 | 2 | 3 | 4 | 5 | 6 | 7)).toHaveLength(6);
    }
  });

  it("keeps every day in exact question-one through question-six order", () => {
    for (let day = 1; day <= 7; day += 1) {
      const questions = getOfflineQuestionsForDay(day as 1 | 2 | 3 | 4 | 5 | 6 | 7);
      expect(questions.map((question) => question.exercise.id)).toEqual(
        Array.from({ length: 6 }, (_, index) => `D${day}_Q${index + 1}`),
      );
      expect(questions.map((question) => question.order)).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it("contains only the three physical-button response families", () => {
    const questions = HARU_WEEK_PLAN.flatMap((plan) => getOfflineQuestionsForDay(plan.day));
    expect(new Set(questions.map((question) => question.responseType))).toEqual(
      new Set(["single_choice", "voice", "button_sequence"]),
    );
    expect(questions.filter((question) => question.responseType === "single_choice")).toHaveLength(33);
    expect(questions.filter((question) => question.responseType === "button_sequence")).toHaveLength(2);
    expect(questions.filter((question) => question.responseType === "voice")).toHaveLength(7);
  });

  it("keeps four spatial options for every choice and sequence question", () => {
    for (const plan of HARU_WEEK_PLAN) {
      for (const question of getOfflineQuestionsForDay(plan.day)) {
        if (question.responseType === "single_choice") {
          expect(question.exercise.payload.options).toHaveLength(4);
        }
        if (question.responseType === "button_sequence") {
          expect(question.exercise.payload.items).toHaveLength(4);
          expect(question.exercise.payload.requiredSelectionCount).toBe(3);
        }
      }
    }
  });
});
