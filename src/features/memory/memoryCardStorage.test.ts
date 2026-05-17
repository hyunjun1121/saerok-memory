import { describe, it, expect } from "vitest";
import { upsertMemoryCueCard, getMemoryCards } from "./memoryCardStorage";

describe("memoryCardStorage", () => {
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
});
