import type { LocalizedText } from "@/utils/localizedText";

export type ExerciseType =
  | "multiple_choice_meaning"
  | "sequence_order"
  | "personal_memory_recall"
  | "attention_pattern";

export interface AnswerOption {
  id: string;
  label: LocalizedText;
  value?: string;
  imageUrl?: string;
  accessibilityLabel?: LocalizedText;
}

export interface ExercisePayload {
  audioText?: LocalizedText;
  instructionText?: LocalizedText;
  linkedConceptId?: string;
  memoryField?: "topic" | "emotionTag" | "peopleTags" | "placeTag" | "story";
  options?: AnswerOption[];
  items?: AnswerOption[];
  requiredSelectionCount?: number;
  durationSeconds?: number;
}

export interface Exercise {
  id: string;
  lessonId: string;
  type: ExerciseType;
  prompt: LocalizedText;
  payload: ExercisePayload;
  correctAnswer: string | string[] | null;
  explanation?: LocalizedText;
  difficulty: 1 | 2 | 3 | 4 | 5;
  accessibilityHint?: LocalizedText;
}
