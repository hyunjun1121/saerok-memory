import { describe, it, expect } from "vitest";
import { saveCognitiveRoutineResult, getCognitiveRoutineResults, clearCognitiveRoutineResults } from "./cognitiveRoutineStorage";

describe("cognitiveRoutineStorage", () => {
  it("should save and retrieve cognitive routine results", () => {
    localStorage.clear();

    saveCognitiveRoutineResult({
      type: "delayed_word_recall",
      completed: true,
    });

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("delayed_word_recall");
    expect(results[0].completed).toBe(true);
  });

  it("should clear cognitive routine results", () => {
    localStorage.clear();

    saveCognitiveRoutineResult({
      type: "attention_pattern",
      completed: true,
    });

    clearCognitiveRoutineResults();

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(0);
  });
});
