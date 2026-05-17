import type { TFunction } from "i18next";
import type { MemoryCard } from "../memory/types";

export interface ConversationCue {
  id: string;
  text: string;
}

function fallbackCues(t: TFunction): ConversationCue[] {
  return [
    {
      id: "fallback-easiest",
      text: t("family.cues.fallbackEasiest"),
    },
    {
      id: "fallback-tomorrow",
      text: t("family.cues.fallbackTomorrow"),
    },
  ];
}

function pushUniqueCue(cues: ConversationCue[], cue: ConversationCue) {
  if (!cues.some((existing) => existing.id === cue.id || existing.text === cue.text)) {
    cues.push(cue);
  }
}

export function generateConversationCues(cards: MemoryCard[], t: TFunction): ConversationCue[] {
  const shareableCards = cards
    .filter((card) => card.shareWithFamily)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const cues: ConversationCue[] = [];

  if (shareableCards.length === 0) {
    return fallbackCues(t);
  }

  shareableCards.forEach((card) => {
    if (card.textSummary) {
      pushUniqueCue(cues, {
        id: `cue-summary-${card.id}`,
        text: t("family.cues.askSummary", { summary: card.textSummary }),
      });
    }

    if (card.emotionTag) {
      pushUniqueCue(cues, {
        id: `cue-emotion-${card.id}`,
        text: t("family.cues.askEmotion", { emotion: card.emotionTag }),
      });
    }

    const person = card.peopleTags?.[0] ?? card.storyCues?.people?.[0];
    if (person) {
      pushUniqueCue(cues, {
        id: `cue-people-${card.id}`,
        text: t("family.cues.askPeople", { person }),
      });
    }

    const place = card.placeTag ?? card.storyCues?.places?.[0];
    if (place) {
      pushUniqueCue(cues, {
        id: `cue-place-${card.id}`,
        text: t("family.cues.askPlace", { place }),
      });
    }
  });

  return cues.length > 0 ? cues.slice(0, 4) : fallbackCues(t);
}
