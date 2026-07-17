import type { MemoryCard } from "@/features/memory/types";
import { readJsonArray, writeJson } from "@/utils/safeStorage";

const STORAGE_KEY = "memoryCards";

export function getMemoryCards(): MemoryCard[] {
  return readJsonArray<MemoryCard>(STORAGE_KEY);
}

export function saveMemoryCards(cards: MemoryCard[]): void {
  writeJson(STORAGE_KEY, cards);
}

// Demo seed: a single pre-existing memory card so the recall question
// ("you mentioned eating out with your family yesterday...") has real
// grounding. Idempotent — only seeds once, so it never clobbers user data.
export function ensureDemoSeedCards(): void {
  const cards = getMemoryCards();
  if (cards.some((card) => card.id === "seed_dining_memory")) {
    return;
  }

  const now = new Date().toISOString();
  cards.push({
    id: "seed_dining_memory",
    userId: "local_user",
    createdAt: now,
    updatedAt: now,
    source: "daily_lesson",
    linkedConceptId: "seed_dining_memory",
    topic: "food",
    peopleTags: ["가족"],
    textSummary: "어제 가족과 함께 외식했다",
    storyCues: { people: ["가족"], timeHints: ["어제"] },
    inputMode: "speech",
    sensitivity: "personal",
    shareWithFamily: false,
    reviewState: {
      dueAt: now,
      intervalDays: 1,
      ease: 2.5,
      reviewCount: 1,
      lastResult: "remembered",
    },
  });

  saveMemoryCards(cards);
}

export function upsertMemoryCueCard(
  cardUpdate: Partial<MemoryCard> & { linkedConceptId: string; lessonId?: string }
): void {
  const cards = getMemoryCards();

  // Find an existing draft or card from the same concept in the same lesson (or generally same concept if lessonId isn't perfectly tracked yet)
  const existingIndex = cards.findIndex(
    (c) => c.linkedConceptId === cardUpdate.linkedConceptId && c.source === "daily_lesson"
  );

  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    const existing = cards[existingIndex];
    // Merge fields, writing through every provided value. Only `undefined` is
    // skipped (the caller chose not to set it). An explicit `null` is
    // meaningful — e.g. recognitionError: null means "no error" and MUST
    // overwrite a stale prior error on the same card (STT-1).
    const safeUpdate = Object.fromEntries(
      Object.entries(cardUpdate).filter(([, v]) => v !== undefined),
    );

    cards[existingIndex] = {
      ...existing,
      ...safeUpdate,
      updatedAt: now,
    };
  } else {
    const newCard: MemoryCard = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId: "local_user",
      createdAt: now,
      updatedAt: now,
      source: "daily_lesson",
      sensitivity: "personal",
      shareWithFamily: false,
      reviewState: {
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        intervalDays: 1,
        ease: 2.5,
        reviewCount: 0,
      },
      ...cardUpdate,
    };
    cards.push(newCard);
  }

  saveMemoryCards(cards);
}
