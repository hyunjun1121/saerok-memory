import { afterEach, describe, it, expect, vi } from "vitest";
import { saveCognitiveRoutineResult, getCognitiveRoutineResults, clearCognitiveRoutineResults, isTodayRoutineCompleted } from "@/features/cognitive/cognitiveRoutineStorage";

describe("cognitiveRoutineStorage", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  it("persists compact telemetry without canvas, path, or blob URL payloads", () => {
    localStorage.clear();

    saveCognitiveRoutineResult({
      type: "shape_copy_practice",
      completed: true,
      metadata: {
        dataUrl: "data:image/png;base64,private-canvas",
        sampledPath: [{ x: 1, y: 2, elapsedMs: 3 }],
        sampledPointCount: 1,
        strokeCount: 1,
        audioAssetUrl: "blob:private-audio",
        nested: {
          dataUrl: "data:image/png;base64,nested-private-canvas",
          sampledPath: [{ x: 4, y: 5 }],
          sampledPointCount: 1,
          audioAssetUrl: "blob:nested-private-audio",
        },
      },
    });

    const raw = localStorage.getItem("cognitiveRoutineResults") ?? "";
    expect(raw).not.toContain("private-canvas");
    expect(raw).not.toContain("sampledPath");
    expect(raw).not.toContain("blob:private-audio");

    const [result] = getCognitiveRoutineResults();
    expect(result.metadata).toMatchObject({
      sampledPointCount: 1,
      strokeCount: 1,
      nested: { sampledPointCount: 1 },
    });
  });

  it("keeps only 365 rolling days and at most 4000 compact records", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T12:00:00.000Z"));
    localStorage.clear();
    const recent = Array.from({ length: 4_005 }, (_, index) => ({
      id: `recent_${index}`,
      type: "attention_pattern",
      timestamp: new Date(Date.UTC(2026, 6, 17, 0, 0, index)).toISOString(),
      completed: true,
    }));
    localStorage.setItem(
      "cognitiveRoutineResults",
      JSON.stringify([
        {
          id: "expired",
          type: "attention_pattern",
          timestamp: "2025-07-17T11:59:59.000Z",
          completed: true,
        },
        ...recent,
      ]),
    );

    saveCognitiveRoutineResult({ type: "attention_pattern", completed: true });

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(4_000);
    expect(results.some((result) => result.id === "expired")).toBe(false);
    expect(results.some((result) => result.id === "recent_0")).toBe(false);
    expect(results.at(-1)?.timestamp).toBe("2026-07-18T12:00:00.000Z");
  });

  it("ignores invalid legacy array entries", () => {
    localStorage.setItem(
      "cognitiveRoutineResults",
      JSON.stringify([null, "bad", {}, { id: "bad", timestamp: "not-a-date" }]),
    );

    expect(getCognitiveRoutineResults()).toEqual([]);
    expect(() => isTodayRoutineCompleted()).not.toThrow();
  });

  it("does not throw when storage quota rejects a compact result", () => {
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    expect(() =>
      saveCognitiveRoutineResult({ type: "attention_pattern", completed: true }),
    ).not.toThrow();
  });
});
