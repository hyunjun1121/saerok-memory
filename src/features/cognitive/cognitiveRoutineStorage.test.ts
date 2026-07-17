import { afterEach, describe, it, expect, vi } from "vitest";
import {
  saveCognitiveRoutineResult,
  getCognitiveRoutineResults,
  clearCognitiveRoutineResults,
  isTodayRoutineCompleted,
  patchCognitiveRoutineResultById,
  scrubCognitiveVoiceData,
  subscribeToCognitiveRoutineResults,
} from "@/features/cognitive/cognitiveRoutineStorage";
import { HARU_CONSENT_STORAGE_KEY } from "@/features/profile/haruConsentStorage";

function setLongitudinalConsent(enabled: boolean): void {
  localStorage.setItem(
    HARU_CONSENT_STORAGE_KEY,
    JSON.stringify({
      voiceRecording: true,
      sttProcessing: true,
      longitudinalUsageStorage: enabled,
      personalizedQuestionUse: true,
      consentedAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T00:00:00.000Z",
    }),
  );
}

describe("cognitiveRoutineStorage", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("notifies open consumers after same-tab writes, clears, and cross-tab changes", () => {
    localStorage.clear();
    const listener = vi.fn();
    const unsubscribe = subscribeToCognitiveRoutineResults(listener);

    saveCognitiveRoutineResult({
      type: "delayed_word_recall",
      completed: true,
    });
    expect(listener).toHaveBeenCalledTimes(1);

    clearCognitiveRoutineResults();
    expect(listener).toHaveBeenCalledTimes(2);

    window.dispatchEvent(
      new StorageEvent("storage", { key: "cognitiveRoutineResults" }),
    );
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    clearCognitiveRoutineResults();
    expect(listener).toHaveBeenCalledTimes(3);
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

  it("returns a stable id and patches metadata on the same stored result", () => {
    localStorage.clear();

    const id = saveCognitiveRoutineResult({
      type: "verbal_fluency_practice",
      completed: true,
      metadata: { category: "과일", sttStatus: "pending" },
    });

    expect(id).toMatch(/^routine_/);
    expect(
      patchCognitiveRoutineResultById(id!, {
        transcript: "사과 배",
        entries: ["사과", "배"],
        uniqueCount: 2,
        sttStatus: "completed",
      }),
    ).toBe(true);

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id,
      metadata: {
        category: "과일",
        transcript: "사과 배",
        entries: ["사과", "배"],
        uniqueCount: 2,
        sttStatus: "completed",
      },
    });
  });

  it("does not create a result when a background patch target is stale", () => {
    localStorage.clear();

    expect(
      patchCognitiveRoutineResultById("missing", { transcript: "discard me" }),
    ).toBe(false);
    expect(getCognitiveRoutineResults()).toEqual([]);
  });

  it("should clear cognitive routine results", () => {
    localStorage.clear();

    saveCognitiveRoutineResult({
      type: "attention_pattern",
      completed: true,
    });

    expect(clearCognitiveRoutineResults()).toBe(true);

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(0);
  });

  it("purges persisted results and rejects writes when longitudinal consent is off", () => {
    localStorage.clear();
    localStorage.setItem(
      "cognitiveRoutineResults",
      JSON.stringify([
        {
          id: "old",
          type: "attention_pattern",
          timestamp: "2026-07-18T00:00:00.000Z",
          completed: true,
        },
      ]),
    );
    setLongitudinalConsent(false);

    expect(getCognitiveRoutineResults()).toEqual([]);
    expect(localStorage.getItem("cognitiveRoutineResults")).toBeNull();
    expect(
      saveCognitiveRoutineResult({ type: "attention_pattern", completed: true }),
    ).toBeNull();
    expect(patchCognitiveRoutineResultById("old", { value: 1 })).toBe(false);
    expect(localStorage.getItem("cognitiveRoutineResults")).toBeNull();
  });

  it("scrubs voice-derived metadata while preserving nonvoice routine facts", () => {
    localStorage.clear();
    saveCognitiveRoutineResult({
      type: "verbal_fluency_practice",
      completed: true,
      metadata: {
        category: "과일",
        attempt: 2,
        transcript: "사과 배",
        entries: ["사과", "배"],
        uniqueCount: 2,
        repetitionCount: 0,
        pronunciationSimilarity: 0.8,
        speechDurationMs: 4_000,
        sttStatus: "completed",
        sttEngine: "qwen",
        sttSegments: [{ text: "사과 배" }],
        recognitionError: null,
      },
    });
    saveCognitiveRoutineResult({
      type: "attention_pattern",
      completed: true,
      metadata: { correct: true, reactionTimeMs: 900 },
    });

    expect(scrubCognitiveVoiceData()).toBe(true);

    const [voice, nonvoice] = getCognitiveRoutineResults();
    expect(voice.metadata).toEqual({ category: "과일", attempt: 2 });
    expect(nonvoice.metadata).toEqual({ correct: true, reactionTimeMs: 900 });
    expect(localStorage.getItem("cognitiveRoutineResults")).not.toMatch(
      /사과 배|transcript|entries|sttEngine|pronunciationSimilarity/,
    );
  });

  it("returns false when clearing persistent results cannot be verified", () => {
    localStorage.clear();
    saveCognitiveRoutineResult({ type: "attention_pattern", completed: true });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(clearCognitiveRoutineResults()).toBe(false);
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
