import type { TFunction } from "i18next";
import type { MemoryCard } from "../memory/types";

export interface ConversationCue {
  id: string;
  text: string;
}

export function generateConversationCues(cards: MemoryCard[], t: TFunction): ConversationCue[] {
  const shareableCards = cards.filter((card) => card.shareWithFamily);
  const cues: ConversationCue[] = [];

  if (shareableCards.length === 0) {
    cues.push({
      id: "fallback-easiest",
      text: t("family.cues.fallbackEasiest", "오늘 연습 중에 어떤 활동이 가장 편하셨는지 여쭤보세요."),
    });
    cues.push({
      id: "fallback-tomorrow",
      text: t("family.cues.fallbackTomorrow", "내일은 어떤 연습을 다시 해보고 싶으신지 여쭤보세요."),
    });
    return cues;
  }

  shareableCards.forEach((card) => {
    if (card.textSummary) {
      cues.push({
        id: `cue-summary-${card.id}`,
        text: t("family.cues.askSummary", { summary: card.textSummary }),
      });
    }

    if (card.emotionTag) {
      cues.push({
        id: `cue-emotion-${card.id}`,
        text: t("family.cues.askEmotion", { emotion: card.emotionTag }),
      });
    }

    if (card.peopleTags && card.peopleTags.length > 0) {
      cues.push({
        id: `cue-people-${card.id}`,
        text: t("family.cues.askPeople", { person: card.peopleTags[0] }),
      });
    } else if (card.storyCues?.people && card.storyCues.people.length > 0) {
      cues.push({
        id: `cue-story-people-${card.id}`,
        text: t("family.cues.askPeople", { person: card.storyCues.people[0] }),
      });
    }

    if (card.placeTag) {
      cues.push({
        id: `cue-place-${card.id}`,
        text: t("family.cues.askPlace", { place: card.placeTag }),
      });
    }
  });

  // Return a maximum of 4 unique-ish cues for the UI
  return cues.slice(0, 4);
}
