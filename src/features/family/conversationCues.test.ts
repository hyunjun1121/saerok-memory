import { describe, it, expect, vi } from "vitest";
import { generateConversationCues } from "./conversationCues";
import type { MemoryCard } from "../memory/types";

describe("generateConversationCues", () => {
  const mockT = vi.fn((key: string, options?: Record<string, string>) => {
    if (options) {
      return `${key} ${JSON.stringify(options)}`;
    }
    return key;
  });

  const baseCard: MemoryCard = {
    id: "test1",
    userId: "user1",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    source: "daily_lesson",
    sensitivity: "low",
    shareWithFamily: false,
    reviewState: {
      dueAt: "2024-01-01T00:00:00.000Z",
      intervalDays: 1,
      ease: 2.5,
      reviewCount: 1,
    },
  };

  it("returns fallback cues when there are no shareable cards", () => {
    const cards: MemoryCard[] = [{ ...baseCard, shareWithFamily: false }];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - mockT doesn't fully match TFunction interface but is fine for tests
    const cues = generateConversationCues(cards, mockT);

    expect(cues).toHaveLength(2);
    expect(cues[0].id).toBe("fallback-easiest");
    expect(cues[1].id).toBe("fallback-tomorrow");
  });

  it("generates cues from shareable cards using textSummary", () => {
    const cards: MemoryCard[] = [
      {
        ...baseCard,
        shareWithFamily: true,
        textSummary: "a nice walk",
      },
    ];

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const cues = generateConversationCues(cards, mockT);
    expect(cues).toHaveLength(1);
    expect(cues[0].id).toBe("cue-summary-test1");
    expect(cues[0].text).toContain("family.cues.askSummary");
    expect(cues[0].text).toContain("a nice walk");
  });

  it("generates cues from emotionTag and peopleTags", () => {
    const cards: MemoryCard[] = [
      {
        ...baseCard,
        shareWithFamily: true,
        emotionTag: "happy",
        peopleTags: ["daughter"],
      },
    ];

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const cues = generateConversationCues(cards, mockT);
    expect(cues).toHaveLength(2);
    expect(cues[0].id).toBe("cue-emotion-test1");
    expect(cues[0].text).toContain("family.cues.askEmotion");
    expect(cues[1].id).toBe("cue-people-test1");
    expect(cues[1].text).toContain("family.cues.askPeople");
  });

  it("limits the output to 4 cues", () => {
    const cards: MemoryCard[] = [
      {
        ...baseCard,
        shareWithFamily: true,
        textSummary: "a nice walk",
        emotionTag: "happy",
        peopleTags: ["daughter"],
        placeTag: "park",
      },
      {
        ...baseCard,
        id: "test2",
        shareWithFamily: true,
        textSummary: "another walk",
      }
    ];

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const cues = generateConversationCues(cards, mockT);
    expect(cues).toHaveLength(4);
  });
});
