import { MemoryCard, ReviewState } from "./types";

export function calculateNextReviewState(
  currentState: ReviewState | undefined,
  result: "remembered" | "hint_used" | "missed" | "skipped"
): ReviewState {
  const now = new Date();

  if (!currentState) {
    return {
      dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      intervalDays: 1,
      ease: 2.5,
      lastResult: result,
      reviewCount: 1,
    };
  }

  let nextInterval = currentState.intervalDays;
  let nextEase = currentState.ease;

  if (result === "remembered") {
    if (nextInterval === 0) nextInterval = 1;
    else if (nextInterval === 1) nextInterval = 3;
    else if (nextInterval === 3) nextInterval = 7;
    else if (nextInterval === 7) nextInterval = 21;
    else if (nextInterval === 21) nextInterval = 45;
    else nextInterval = Math.round(nextInterval * nextEase);
  } else if (result === "missed" || result === "hint_used") {
    nextInterval = Math.max(1, Math.round(nextInterval * 0.5));
    nextEase = Math.max(1.3, nextEase - 0.2);
  }

  const dueAt = new Date(now.getTime() + nextInterval * 24 * 60 * 60 * 1000).toISOString();

  return {
    dueAt,
    intervalDays: nextInterval,
    ease: nextEase,
    lastResult: result,
    reviewCount: currentState.reviewCount + 1,
  };
}

export function calculatePriority(card: MemoryCard): number {
  const now = new Date().getTime();
  const dueTime = new Date(card.reviewState.dueAt).getTime();

  const forgettingRisk = Math.max(0, (now - dueTime) / (24 * 60 * 60 * 1000));
  const dueWeight = now >= dueTime ? 10 : 0;
  const errorWeight = (card.reviewState.lastResult === "missed" || card.reviewState.lastResult === "hint_used") ? 5 : 0;
  const personalWeight = (card.topic === "family" || card.emotionTag) ? 3 : 0;
  const recentSuccessWeight = card.reviewState.lastResult === "remembered" ? 2 : 0;

  return forgettingRisk + errorWeight + personalWeight + dueWeight - recentSuccessWeight;
}
