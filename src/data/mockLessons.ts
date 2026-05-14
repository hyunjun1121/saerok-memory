export interface Lesson {
  id: string;
  unitId: string;
  title: string;
  description: string;
  conceptIds: string[];
  exerciseIds: string[];
  estimatedMinutes: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  lessonType: "new_concept" | "review" | "personal_memory" | "attention" | "mixed";
}

export const mockLessons: Record<string, Lesson> = {
  "lesson_1": {
    id: "lesson_1",
    unitId: "unit_1",
    title: "시작하기: 좋은 기억",
    description: "고진감래와 일석이조의 뜻을 배우고 기억을 떠올려봅니다.",
    conceptIds: ["concept_1", "concept_2"],
    exerciseIds: ["ex_1", "ex_2", "ex_3", "ex_4", "ex_5", "ex_6"],
    estimatedMinutes: 5,
    difficulty: 1,
    lessonType: "mixed",
  }
};
