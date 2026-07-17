import { describe, it, expect } from "vitest";
import { saveCognitiveRoutineResult, getCognitiveRoutineResults, clearCognitiveRoutineResults, isTodayRoutineCompleted } from "@/features/cognitive/cognitiveRoutineStorage";

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

  describe("isTodayRoutineCompleted (SP-07 launch auto-start)", () => {
    it("returns true when a routine was completed today", () => {
      localStorage.clear();
      saveCognitiveRoutineResult({ type: "attention_pattern", completed: true });
      expect(isTodayRoutineCompleted()).toBe(true);
    });

    it("returns false when nothing is completed today", () => {
      localStorage.clear();
      saveCognitiveRoutineResult({ type: "attention_pattern", completed: false });
      expect(isTodayRoutineCompleted()).toBe(false);
    });

    it("returns false when results are empty", () => {
      localStorage.clear();
      expect(isTodayRoutineCompleted()).toBe(false);
    });
  });
});
