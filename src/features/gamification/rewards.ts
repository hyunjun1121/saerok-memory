export function calculateExerciseReward(
  result: "correct_first_try" | "hint_used" | "completed" | "memory_review"
): number {
  switch (result) {
    case "correct_first_try":
      return 3;
    case "hint_used":
      return 1;
    case "completed":
      return 2;
    case "memory_review":
      return 5;
    default:
      return 0;
  }
}

export function calculateSessionCompletionReward(): number {
  return 10;
}
