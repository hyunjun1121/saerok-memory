import { afterEach, describe, it, expect, vi } from "vitest";
import {
  getMemoryCards,
  saveMemoryCards,
  upsertMemoryCueCard,
} from "@/features/memory/memoryCardStorage";

describe("memoryCardStorage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
