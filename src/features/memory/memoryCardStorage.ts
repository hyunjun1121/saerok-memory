import type { MemoryCard } from "@/features/memory/types";
import { getHaruConsent } from "@/features/profile/haruConsentStorage";
import { readJsonArray, writeJson } from "@/utils/safeStorage";

const STORAGE_KEY = "memoryCards";
export const MEMORY_CARDS_UPDATED_EVENT = "haru:memory-cards-updated";

const MEMORY_SOURCES = new Set<MemoryCard["source"]>([
  "daily_lesson",
  "family_upload",
  "voice_note",
  "manual_entry",
]);
const SENSITIVITY_LEVELS = new Set<MemoryCard["sensitivity"]>([
  "low",
  "personal",
  "sensitive",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMemoryCard(value: unknown): value is MemoryCard {
  if (!isRecord(value) || !isRecord(value.reviewState)) return false;
  const reviewState = value.reviewState;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.userId === "string" &&
    typeof value.createdAt === "string" &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.updatedAt === "string" &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    typeof value.source === "string" &&
    MEMORY_SOURCES.has(value.source as MemoryCard["source"]) &&
    typeof value.sensitivity === "string" &&
    SENSITIVITY_LEVELS.has(value.sensitivity as MemoryCard["sensitivity"]) &&
    typeof value.shareWithFamily === "boolean" &&
    typeof reviewState.dueAt === "string" &&
    Number.isFinite(Date.parse(reviewState.dueAt)) &&
    typeof reviewState.intervalDays === "number" &&
    Number.isFinite(reviewState.intervalDays) &&
    typeof reviewState.ease === "number" &&
    Number.isFinite(reviewState.ease) &&
    typeof reviewState.reviewCount === "number" &&
    Number.isFinite(reviewState.reviewCount)
  );
}

function sanitizeMemoryCard(card: MemoryCard): MemoryCard {
  if (
    typeof card.audioAssetUrl !== "string" ||
    !card.audioAssetUrl.startsWith("blob:")
  ) {
    return card;
  }
  const durableCard = { ...card };
  delete durableCard.audioAssetUrl;
  return durableCard;
}

function notifyMemoryCardsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MEMORY_CARDS_UPDATED_EVENT));
}

function clearPersistedCards(notifyWhenAlreadyEmpty = false): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const hadPersistedCards = window.localStorage.getItem(STORAGE_KEY) !== null;
    window.localStorage.removeItem(STORAGE_KEY);
    const removed = window.localStorage.getItem(STORAGE_KEY) === null;
    if (removed && (hadPersistedCards || notifyWhenAlreadyEmpty)) {
      notifyMemoryCardsChanged();
    }
    return removed;
  } catch {
    return false;
  }
}

function persistMemoryCards(cards: readonly MemoryCard[]): boolean {
  const saved = writeJson(STORAGE_KEY, cards);
  if (saved) notifyMemoryCardsChanged();
  return saved;
}

export function subscribeToMemoryCards(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onLocalUpdate = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(MEMORY_CARDS_UPDATED_EVENT, onLocalUpdate);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MEMORY_CARDS_UPDATED_EVENT, onLocalUpdate);
    window.removeEventListener("storage", onStorage);
  };
}

function isVoiceDerivedCard(card: MemoryCard): boolean {
  return (
    card.source === "voice_note" ||
    card.inputMode === "speech" ||
    card.inputMode === "mixed" ||
    card.originalTranscript !== undefined ||
    card.speechDurationMs !== undefined ||
    card.recognitionError !== undefined ||
    card.sttStatus !== undefined ||
    card.sttNoSpeech !== undefined ||
    card.sttEngine !== undefined ||
    card.sttModel !== undefined ||
    card.sttSegments !== undefined ||
    card.audioAssetUrl !== undefined
  );
}

function scrubVoiceDerivedCard(card: MemoryCard): MemoryCard {
  if (!isVoiceDerivedCard(card)) return card;
  const scrubbed = { ...card };
  delete scrubbed.originalTranscript;
  delete scrubbed.textSummary;
  delete scrubbed.storyCues;
  delete scrubbed.inputMode;
  delete scrubbed.speechDurationMs;
  delete scrubbed.recognitionError;
  delete scrubbed.audioAssetUrl;
  delete scrubbed.sttStatus;
  delete scrubbed.sttNoSpeech;
  delete scrubbed.sttEngine;
  delete scrubbed.sttModel;
  delete scrubbed.sttModelRevision;
  delete scrubbed.sttAlignerModel;
  delete scrubbed.sttAlignerRevision;
  delete scrubbed.sttPreprocessingVersion;
  delete scrubbed.sttLanguage;
  delete scrubbed.sttConfidence;
  delete scrubbed.sttSegments;
  return scrubbed;
}

export function getMemoryCards(): MemoryCard[] {
  if (!getHaruConsent().longitudinalUsageStorage) {
    clearPersistedCards();
    return [];
  }
  const stored = readJsonArray<unknown>(STORAGE_KEY);
  const cards = stored.filter(isMemoryCard).map(sanitizeMemoryCard);
  const needsCleanup =
    cards.length !== stored.length ||
    stored.some(
      (value) =>
        isMemoryCard(value) &&
        typeof value.audioAssetUrl === "string" &&
        value.audioAssetUrl.startsWith("blob:"),
    );
  if (needsCleanup) {
    persistMemoryCards(cards);
  }
  return cards;
}

export function getMemoryCardById(id: string): MemoryCard | null {
  if (!id) return null;
  return getMemoryCards().find((card) => card.id === id) ?? null;
}

export function saveMemoryCards(cards: MemoryCard[]): boolean {
  if (!getHaruConsent().longitudinalUsageStorage) {
    clearPersistedCards();
    return false;
  }
  return persistMemoryCards(cards.filter(isMemoryCard).map(sanitizeMemoryCard));
}

export function clearMemoryCards(): boolean {
  return clearPersistedCards(true);
}

export function scrubMemoryVoiceData(): boolean {
  if (!getHaruConsent().longitudinalUsageStorage) {
    return clearPersistedCards();
  }
  return saveMemoryCards(getMemoryCards().map(scrubVoiceDerivedCard));
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
): string | null {
  if (!getHaruConsent().longitudinalUsageStorage) {
    clearPersistedCards();
    return null;
  }
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

  const savedCard = existingIndex >= 0 ? cards[existingIndex] : cards.at(-1);
  return saveMemoryCards(cards) ? (savedCard?.id ?? null) : null;
}

/**
 * Patch one existing learner-authored memory cue after background processing.
 * Never creates a missing card: deletion while STT is pending takes precedence.
 */
export function patchMemoryCueCardByLinkedConceptId(
  linkedConceptId: string,
  cardUpdate: Partial<MemoryCard>,
): boolean {
  if (!linkedConceptId) return false;
  if (!getHaruConsent().longitudinalUsageStorage) {
    clearPersistedCards();
    return false;
  }
  const cards = getMemoryCards();
  const index = cards.findIndex(
    (card) =>
      card.linkedConceptId === linkedConceptId && card.source === "daily_lesson",
  );
  if (index < 0) return false;

  const safeUpdate = Object.fromEntries(
    Object.entries(cardUpdate).filter(([, value]) => value !== undefined),
  ) as Partial<MemoryCard>;
  cards[index] = {
    ...cards[index],
    ...safeUpdate,
    id: cards[index].id,
    linkedConceptId: cards[index].linkedConceptId,
    updatedAt: new Date().toISOString(),
  };
  return saveMemoryCards(cards);
}

/**
 * Patch one existing card by immutable id. Background jobs must target this
 * identifier so deleting and recreating a concept cannot receive stale STT.
 */
export function patchMemoryCueCardById(
  id: string,
  cardUpdate: Partial<MemoryCard>,
): boolean {
  if (!id) return false;
  if (!getHaruConsent().longitudinalUsageStorage) {
    clearPersistedCards();
    return false;
  }
  const cards = getMemoryCards();
  const index = cards.findIndex((card) => card.id === id);
  if (index < 0) return false;

  const safeUpdate = Object.fromEntries(
    Object.entries(cardUpdate).filter(([, value]) => value !== undefined),
  ) as Partial<MemoryCard>;
  cards[index] = {
    ...cards[index],
    ...safeUpdate,
    id: cards[index].id,
    updatedAt: new Date().toISOString(),
  };
  return saveMemoryCards(cards);
}
