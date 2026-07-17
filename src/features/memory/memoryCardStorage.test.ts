import { afterEach, describe, it, expect, vi } from "vitest";
import {
  clearMemoryCards,
  getMemoryCardById,
  getMemoryCards,
  patchMemoryCueCardById,
  patchMemoryCueCardByLinkedConceptId,
  saveMemoryCards,
  scrubMemoryVoiceData,
  subscribeToMemoryCards,
  upsertMemoryCueCard,
} from "@/features/memory/memoryCardStorage";
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

describe("memoryCardStorage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("notifies open consumers after same-tab writes, clears, and cross-tab changes", () => {
    localStorage.clear();
    const listener = vi.fn();
    const unsubscribe = subscribeToMemoryCards(listener);

    upsertMemoryCueCard({
      linkedConceptId: "event-memory",
      topic: "daily_life",
    });
    expect(listener).toHaveBeenCalledTimes(1);

    clearMemoryCards();
    expect(listener).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new StorageEvent("storage", { key: "memoryCards" }));
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    clearMemoryCards();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("should merge memory cue fields into a single card for the same concept", () => {
    localStorage.clear();

    upsertMemoryCueCard({
      linkedConceptId: "concept_1",
      topic: "daily_life",
    });

    let cards = getMemoryCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].topic).toBe("daily_life");
    expect(cards[0].emotionTag).toBeUndefined();

    upsertMemoryCueCard({
      linkedConceptId: "concept_1",
      emotionTag: "뿌듯함",
    });

    cards = getMemoryCards();
    expect(cards).toHaveLength(1); // Should have merged
    expect(cards[0].topic).toBe("daily_life");
    expect(cards[0].emotionTag).toBe("뿌듯함");
  });

  it("should not overwrite existing non-empty fields with undefined", () => {
    localStorage.clear();

    upsertMemoryCueCard({
      linkedConceptId: "concept_1",
      topic: "daily_life",
      emotionTag: "뿌듯함"
    });

    upsertMemoryCueCard({
      linkedConceptId: "concept_1",
      placeTag: "공원"
      // not providing topic or emotionTag here
    });

    const cards = getMemoryCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].topic).toBe("daily_life");
    expect(cards[0].emotionTag).toBe("뿌듯함");
    expect(cards[0].placeTag).toBe("공원");
  });

  it("patches a background transcript by linked concept without creating stale targets", () => {
    localStorage.clear();
    upsertMemoryCueCard({
      linkedConceptId: "voice_story",
      originalTranscript: "",
      recognitionError: "stt-pending",
    });

    expect(
      patchMemoryCueCardByLinkedConceptId("voice_story", {
        originalTranscript: "오늘 딸과 공원에 갔어요.",
        textSummary: "오늘 딸과 공원에 갔어요.",
        recognitionError: null,
        sttStatus: "completed",
      }),
    ).toBe(true);
    expect(
      patchMemoryCueCardByLinkedConceptId("missing_story", {
        originalTranscript: "discard me",
      }),
    ).toBe(false);

    const cards = getMemoryCards();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      linkedConceptId: "voice_story",
      originalTranscript: "오늘 딸과 공원에 갔어요.",
      recognitionError: null,
      sttStatus: "completed",
    });
  });

  it("patches by immutable card id without upserting stale targets", () => {
    localStorage.clear();
    const id = upsertMemoryCueCard({
      linkedConceptId: "voice_story",
      topic: "daily_life",
      recognitionError: "stt-pending",
    });

    expect(
      patchMemoryCueCardById(id!, {
        id: "forged-id",
        originalTranscript: "오늘 산책했어요.",
        sttStatus: "completed",
        recognitionError: null,
      }),
    ).toBe(true);
    expect(
      patchMemoryCueCardById("deleted-card", {
        originalTranscript: "must not reappear",
      }),
    ).toBe(false);
    expect(getMemoryCards()).toEqual([
      expect.objectContaining({
        id,
        linkedConceptId: "voice_story",
        originalTranscript: "오늘 산책했어요.",
        sttStatus: "completed",
        recognitionError: null,
      }),
    ]);
    expect(getMemoryCardById(id!)).toEqual(
      expect.objectContaining({ id, originalTranscript: "오늘 산책했어요." }),
    );
    expect(getMemoryCardById("forged-id")).toBeNull();
    expect(getMemoryCardById("deleted-card")).toBeNull();
  });

  it("purges persisted cards and rejects writes when longitudinal consent is off", () => {
    localStorage.clear();
    const id = upsertMemoryCueCard({
      linkedConceptId: "private",
      topic: "daily_life",
    });
    expect(id).toBeTruthy();
    setLongitudinalConsent(false);

    expect(getMemoryCards()).toEqual([]);
    expect(localStorage.getItem("memoryCards")).toBeNull();
    expect(
      upsertMemoryCueCard({ linkedConceptId: "blocked", topic: "daily_life" }),
    ).toBeNull();
    expect(saveMemoryCards([])).toBe(false);
    expect(patchMemoryCueCardById(id!, { topic: "food" })).toBe(false);
    expect(localStorage.getItem("memoryCards")).toBeNull();
  });

  it("scrubs voice-derived content while preserving manually selected tags", () => {
    localStorage.clear();
    upsertMemoryCueCard({
      linkedConceptId: "voice_story",
      topic: "daily_life",
      peopleTags: ["딸"],
      placeTag: "공원",
      emotionTag: "기쁨",
      inputMode: "speech",
      originalTranscript: "딸과 공원에 갔어요.",
      textSummary: "공원 산책",
      storyCues: { people: ["딸"], places: ["공원"] },
      speechDurationMs: 4_200,
      audioAssetUrl: "https://assets.example/private.webm",
      sttStatus: "completed",
      sttEngine: "qwen",
      sttModel: "Qwen3-ASR",
      sttConfidence: 0.9,
      sttSegments: [{ id: 0, start: 0, end: 1, text: "비밀" }],
      recognitionError: null,
    });

    expect(scrubMemoryVoiceData()).toBe(true);

    expect(getMemoryCards()[0]).toEqual(
      expect.objectContaining({
        linkedConceptId: "voice_story",
        topic: "daily_life",
        peopleTags: ["딸"],
        placeTag: "공원",
        emotionTag: "기쁨",
      }),
    );
    expect(getMemoryCards()[0]).not.toEqual(
      expect.objectContaining({ originalTranscript: expect.anything() }),
    );
    expect(localStorage.getItem("memoryCards")).not.toMatch(
      /딸과 공원에 갔어요|공원 산책|private\.webm|Qwen3-ASR|sttSegments/,
    );
  });

  it("returns verified clear status", () => {
    localStorage.clear();
    upsertMemoryCueCard({ linkedConceptId: "to-clear", topic: "daily_life" });
    expect(clearMemoryCards()).toBe(true);

    upsertMemoryCueCard({ linkedConceptId: "blocked-clear", topic: "daily_life" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(clearMemoryCards()).toBe(false);
  });

  it("clears a stale recognitionError when a later save passes null (STT-1)", () => {
    localStorage.clear();

    upsertMemoryCueCard({
      linkedConceptId: "concept_x",
      originalTranscript: "",
      recognitionError: "transcribe-failed",
    });

    upsertMemoryCueCard({
      linkedConceptId: "concept_x",
      originalTranscript: "오늘 산책했어요.",
      recognitionError: null,
    });

    const cards = getMemoryCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].originalTranscript).toBe("오늘 산책했어요.");
    expect(cards[0].recognitionError).toBeNull();
  });

  it("never persists ephemeral blob audio URLs", () => {
    localStorage.clear();

    upsertMemoryCueCard({
      linkedConceptId: "concept_voice",
      audioAssetUrl: "blob:private-audio",
      originalTranscript: "오늘 산책했어요.",
    });

    const raw = localStorage.getItem("memoryCards") ?? "";
    expect(raw).not.toContain("blob:private-audio");
    expect(getMemoryCards()[0].audioAssetUrl).toBeUndefined();
  });

  it("sanitizes blob URLs from legacy cards while preserving durable URLs", () => {
    localStorage.clear();
    const baseCard = {
      id: "legacy",
      userId: "local_user",
      createdAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T00:00:00.000Z",
      source: "daily_lesson" as const,
      sensitivity: "personal" as const,
      shareWithFamily: false,
      reviewState: {
        dueAt: "2026-07-19T00:00:00.000Z",
        intervalDays: 1,
        ease: 2.5,
        reviewCount: 0,
      },
    };
    saveMemoryCards([
      { ...baseCard, audioAssetUrl: "blob:legacy-private" },
      { ...baseCard, id: "durable", audioAssetUrl: "https://assets.example/audio.webm" },
    ]);

    const cards = getMemoryCards();
    expect(cards[0].audioAssetUrl).toBeUndefined();
    expect(cards[1].audioAssetUrl).toBe("https://assets.example/audio.webm");
    expect(localStorage.getItem("memoryCards")).not.toContain("blob:legacy-private");
  });

  it("filters invalid legacy entries without throwing", () => {
    localStorage.setItem("memoryCards", JSON.stringify([null, "bad", {}, { id: 123 }]));

    expect(getMemoryCards()).toEqual([]);
  });

  it("does not throw when storage quota rejects sanitized cards", () => {
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    expect(() =>
      upsertMemoryCueCard({
        linkedConceptId: "quota-safe",
        originalTranscript: "기억",
        audioAssetUrl: "blob:must-not-persist",
      }),
    ).not.toThrow();
  });
});
