// Family-facing (보호자) summary. Deliberately lighter than the counselor report:
// it exposes participation flow, recent activity, and gentle conversation
// starters, but NOT raw performance counts, error counts, or response times
// (SP-08). Nothing here reads as a diagnosis or screening result.
import type { MemoryCard } from "../memory/types";
import type { RoutineResult } from "../cognitive/cognitiveRoutineStorage";
import type {
  CaregiverObservationDomain,
  CaregiverObservationRecord,
} from "./caregiverObservationStorage";
import type { ReportCopyItem } from "./caregiverReport";
import { generateHaruAdvisorySummary } from "./haruAdvisory";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;

function parseIsoDate(value?: string): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export interface FamilySupportSummary {
  completedThisWeek: number;
  attemptedThisWeek: number;
  hasRecentActivity: boolean;
  lastPracticeDate?: string;
  shareableMemoryCount: number;
  conversationStarters: ReportCopyItem[];
  encouragement: ReportCopyItem;
  // Whether the gentle "consultation resource" card should be offered.
  showSupportResource: boolean;
}

function buildParticipation(routineResults: RoutineResult[], now: Date) {
  const nowTime = now.getTime();
  const windowStart = nowTime - WINDOW_DAYS * ONE_DAY_MS;
  let attempted = 0;
  let completed = 0;
  let lastCompleted: number | null = null;

  routineResults.forEach((result) => {
    const ts = parseIsoDate(result.timestamp);
    if (ts === null || ts > nowTime) return;
    if (ts >= windowStart) {
      attempted += 1;
      if (result.completed) {
        completed += 1;
        if (lastCompleted === null || ts > lastCompleted) lastCompleted = ts;
      }
    }
  });

  return {
    attempted,
    completed,
    lastPracticeDate: lastCompleted !== null ? new Date(lastCompleted).toISOString() : undefined,
  };
}

// Gentle, safe conversation starters derived only from explicitly shareable
// memory cards. Never surfaces raw private transcripts.
function buildConversationStarters(cards: MemoryCard[]): ReportCopyItem[] {
  const shareable = cards.filter((card) => card.shareWithFamily);
  const starters: ReportCopyItem[] = [];

  if (shareable.length === 0) {
    starters.push({ key: "family.cues.fallbackEasiest" });
    return starters;
  }

  shareable.slice(0, 3).forEach((card) => {
    if (card.textSummary) {
      starters.push({
        key: "family.cues.askSummary",
        values: { summary: card.textSummary },
      });
    } else if (card.emotionTag) {
      starters.push({
        key: "family.cues.askEmotion",
        values: { emotion: card.emotionTag },
      });
    }
  });

  return starters;
}

// The support-resource card is shown only when there are repeated caregiver
// concerns or a sustained drop — never from a single session.
function shouldShowSupportResource(
  observationRecords: CaregiverObservationRecord[],
  advisoryLevel: "steady" | "watch" | "needsConversation",
  now: Date,
): boolean {
  if (advisoryLevel === "needsConversation") {
    return true;
  }

  const cutoff = now.getTime() - 30 * ONE_DAY_MS;
  const repeatedConcerns = observationRecords.filter((record) => {
    const ts = parseIsoDate(record.createdAt);
    if (ts === null || ts < cutoff) return false;
    return (Object.values(record.domainResponses) as string[]).includes("oftenDifferent");
  });

  return repeatedConcerns.length >= 2;
}

export function generateFamilySupportSummary(
  memoryCards: MemoryCard[],
  routineResults: RoutineResult[],
  observationRecords: CaregiverObservationRecord[] = [],
  now = new Date(),
): FamilySupportSummary {
  const safeCards = memoryCards ?? [];
  const safeRoutines = routineResults ?? [];
  const safeObservations = observationRecords ?? [];

  const participation = buildParticipation(safeRoutines, now);
  const shareableMemoryCount = safeCards.filter((card) => card.shareWithFamily).length;

  const advisory = generateHaruAdvisorySummary(
    safeCards,
    safeRoutines,
    safeObservations,
    now,
  );

  const encouragement: ReportCopyItem =
    participation.completed >= 3
      ? { key: "family.encouragementBrainActive" }
      : participation.completed > 0
        ? { key: "weekly.completedDays", values: { count: participation.completed } }
        : { key: "family.summaryEmpty" };

  return {
    completedThisWeek: participation.completed,
    attemptedThisWeek: participation.attempted,
    hasRecentActivity: participation.lastPracticeDate !== undefined,
    lastPracticeDate: participation.lastPracticeDate,
    shareableMemoryCount,
    conversationStarters: buildConversationStarters(safeCards),
    encouragement,
    showSupportResource: shouldShowSupportResource(
      safeObservations,
      advisory.level,
      now,
    ),
  };
}

// Re-exported so callers can map observation domains without a second import.
export type { CaregiverObservationDomain };
