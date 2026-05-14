export type ExerciseState =
  | "intro"
  | "awaiting_answer"
  | "answer_selected"
  | "checking"
  | "correct_feedback"
  | "incorrect_feedback"
  | "hint_feedback"
  | "completed";
