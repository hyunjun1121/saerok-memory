import type { MemoryCard } from "./types";

export function getMemoryCards(): MemoryCard[] {
  try {
    const data = localStorage.getItem("memoryCards");
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to parse memoryCards from localStorage", error);
    return [];
  }
}

export function saveMemoryCards(cards: MemoryCard[]): void {
  try {
    localStorage.setItem("memoryCards", JSON.stringify(cards));
  } catch (error) {
    console.error("Failed to save memoryCards to localStorage", error);
  }
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
    // Merge fields carefully: do not aggressively overwrite non-empty fields with undefined or null
    // Specifically spread the update but filter out undefined values to preserve existing data
    const safeUpdate = Object.fromEntries(
      Object.entries(cardUpdate).filter(([, v]) => v !== undefined && v !== null)
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
