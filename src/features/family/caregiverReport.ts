import type { MemoryCard } from "../memory/types";
import type { RoutineResult } from "../cognitive/cognitiveRoutineStorage";
import type {
  CaregiverObservationDomain,
  CaregiverObservationRecord,
} from "./caregiverObservationStorage";
import {
  generateHaruAdvisorySummary,
  type HaruAdvisorySummary,
} from "./haruAdvisory";

export interface ReportCopyItem {
  key: string;
  values?: Record<string, string | number>;
}

export type RoutineTrendDirection = "up" | "flat" | "down";

export interface RoutineParticipationSummary {
  completedThisWindow: number;
  completedPreviousWindow: number;
  attemptedThisWindow: number;
  attemptedPreviousWindow: number;
  trendDirection: RoutineTrendDirection;
  trendSummaryCopy: ReportCopyItem;
  participationRateThisWindow: number;
}

export interface CaregiverCounselorOverview {
  totalRoutines: number;
  completedRoutines: number;
  completionRate: number;
  totalMemoryCards: number;
  dueMemoryCount: number;
  shareableMemoryCount: number;
  metrics: ReportCopyItem[];
  lastPracticeDate?: string;
}

export interface CaregiverCounselorReport {
  overview: CaregiverCounselorOverview;
  routineTrend: RoutineParticipationSummary;
  advisory: HaruAdvisorySummary;
  dueMemoryCount: number;
  shareableMemoryCount: number;
  activityHighlights: ReportCopyItem[];
  conversationCues: ReportCopyItem[];
  strengths: ReportCopyItem[];
  suggestedNextConversationTopics: ReportCopyItem[];
  safetyDisclaimerCopyKeys: string[];
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;
const TREND_KEY_MAP: Record<RoutineTrendDirection, string> = {
  up: "family.report.routineTrendUp",
  down: "family.report.routineTrendDown",
  flat: "family.report.routineTrendFlat",
};

const SAFETY_COPY_KEYS = [
  "family.counselorDisclaimer",
  "family.privacyBody",
  "exercise.memory.story.privacy",
];

const OBSERVATION_TOPIC_KEY_MAP: Record<CaregiverObservationDomain, string> = {
  dailyRoutine: "family.report.nextTopics.observationDailyRoutine",
  conversation: "family.report.nextTopics.observationConversation",
  appointments: "family.report.nextTopics.observationAppointments",
  navigation: "family.report.nextTopics.observationNavigation",
  medicationMoney: "family.report.nextTopics.observationMedicationMoney",
  moodSocial: "family.report.nextTopics.observationMoodSocial",
  sleepAppetite: "family.report.nextTopics.observationSleepAppetite",
  homeSafety: "family.report.nextTopics.observationHomeSafety",
};

function parseIsoDate(value?: string): number | null {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  return time;
}

function addReportItemIfMissing(items: ReportCopyItem[], item: ReportCopyItem): void {
  const serialized = JSON.stringify(item);
  if (!items.some((existing) => JSON.stringify(existing) === serialized)) {
    items.push(item);
  }
}

function getMetadataNumber(result: RoutineResult | undefined, key: string): number | null {
  const value = result?.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getLatestCompletedResult(
  routineResults: RoutineResult[],
  type: RoutineResult["type"],
  now: Date,
): RoutineResult | undefined {
  const nowTime = now.getTime();

  return routineResults
    .filter((result) => result.type === type && result.completed)
    .map((result) => ({
      result,
      timestamp: parseIsoDate(result.timestamp),
    }))
    .filter((entry): entry is { result: RoutineResult; timestamp: number } =>
      entry.timestamp !== null && entry.timestamp <= nowTime,
    )
    .sort((a, b) => b.timestamp - a.timestamp)[0]?.result;
}

function buildActivityHighlights(routineResults: RoutineResult[], now: Date): ReportCopyItem[] {
  const highlights: ReportCopyItem[] = [];
  const latestWordRecall = getLatestCompletedResult(routineResults, "delayed_word_recall", now);
  const latestDigitSpan = getLatestCompletedResult(routineResults, "digit_span_practice", now);
  const latestVerbalFluency = getLatestCompletedResult(routineResults, "verbal_fluency_practice", now);
  const latestTrail = getLatestCompletedResult(routineResults, "trail_switching_practice", now);
  const latestStroop = getLatestCompletedResult(routineResults, "stroop_touch_practice", now);
  const latestOrientation = getLatestCompletedResult(routineResults, "orientation_practice", now);
  const latestDrawing = getLatestCompletedResult(routineResults, "shape_copy_practice", now);

  const wordRecallCorrect =
    getMetadataNumber(latestWordRecall, "correctCount") ??
    getMetadataNumber(latestWordRecall, "wordRecallCorrect");
  if (wordRecallCorrect !== null) {
    addReportItemIfMissing(highlights, {
      key: "family.report.activityHighlights.wordRecall",
      values: {
        count: wordRecallCorrect,
      },
    });
  }

  const digitSpanLength = getMetadataNumber(latestDigitSpan, "spanLength") ?? getMetadataNumber(latestDigitSpan, "digitSpanLength");
  if (digitSpanLength !== null) {
    addReportItemIfMissing(highlights, {
      key: "family.report.activityHighlights.digitSpan",
      values: {
        length: digitSpanLength,
      },
    });
  }

  const verbalFluencyUnique =
    getMetadataNumber(latestVerbalFluency, "uniqueCount") ??
    getMetadataNumber(latestVerbalFluency, "verbalFluencyUniqueCount");
  if (verbalFluencyUnique !== null) {
    addReportItemIfMissing(highlights, {
      key: "family.report.activityHighlights.verbalFluency",
      values: {
        count: verbalFluencyUnique,
      },
    });
  }

  const trailErrors = getMetadataNumber(latestTrail, "errorCount") ?? getMetadataNumber(latestTrail, "trailSwitchingErrors");
  if (trailErrors !== null) {
    addReportItemIfMissing(highlights, {
      key: "family.report.activityHighlights.trail",
      values: {
        count: trailErrors,
      },
    });
  }

  const stroopCorrect = getMetadataNumber(latestStroop, "correctCount");
  const stroopErrors = getMetadataNumber(latestStroop, "errorCount");
  const stroopAverageResponseMs = getMetadataNumber(latestStroop, "averageResponseMs");
  if (stroopCorrect !== null || stroopErrors !== null || stroopAverageResponseMs !== null) {
    addReportItemIfMissing(highlights, {
      key: "family.report.activityHighlights.stroop",
      values: {
        correctCount: stroopCorrect ?? "-",
        errorCount: stroopErrors ?? "-",
        averageSeconds:
          stroopAverageResponseMs !== null
            ? Math.max(0, Math.round(stroopAverageResponseMs / 100) / 10)
            : "-",
      },
    });
  }

  if (latestOrientation) {
    addReportItemIfMissing(highlights, {
      key: "family.report.activityHighlights.orientation",
    });
  }

  const drawingStrokeCount =
    getMetadataNumber(latestDrawing, "strokeCount") ??
    getMetadataNumber(latestDrawing, "drawingStrokeCount");
  const drawingDurationMs =
    getMetadataNumber(latestDrawing, "drawingDurationMs") ??
    getMetadataNumber(latestDrawing, "durationMs");
  if (drawingStrokeCount !== null || drawingDurationMs !== null) {
    addReportItemIfMissing(highlights, {
      key: "family.report.activityHighlights.drawing",
      values: {
        strokeCount: drawingStrokeCount ?? "-",
        seconds: drawingDurationMs !== null ? Math.round(drawingDurationMs / 1000) : "-",
      },
    });
  }

  if (highlights.length === 0 && routineResults.length > 0) {
    addReportItemIfMissing(highlights, {
      key: "family.report.activityHighlights.fallback",
    });
  }

  return highlights.slice(0, 5);
}

function buildConversationCues(cards: MemoryCard[]): ReportCopyItem[] {
  const shareableCards = cards.filter((card) => card.shareWithFamily);

  const cues: ReportCopyItem[] = [];

  if (shareableCards.length === 0) {
    cues.push({
      key: "family.cues.fallbackEasiest",
      values: {
        fallback: "Ask which activity felt easiest during practice.",
      },
    });
    cues.push({
      key: "family.cues.fallbackTomorrow",
      values: {
        fallback: "Ask what activity they might want to try again tomorrow.",
      },
    });
    return cues;
  }

  shareableCards.forEach((card) => {
    if (card.textSummary) {
      addReportItemIfMissing(cues, {
        key: "family.cues.askSummary",
        values: {
          summary: card.textSummary,
          fallback: `Ask more about the shared story: ${card.textSummary}`,
        },
      });
    }

    if (card.emotionTag) {
      addReportItemIfMissing(cues, {
        key: "family.cues.askEmotion",
        values: {
          emotion: card.emotionTag,
          fallback: `Ask what made them feel ${card.emotionTag}.`,
        },
      });
    }

    if (card.peopleTags && card.peopleTags.length > 0) {
      addReportItemIfMissing(cues, {
        key: "family.cues.askPeople",
        values: {
          person: card.peopleTags[0],
          fallback: `Ask about other moments with ${card.peopleTags[0]}.`,
        },
      });
    } else if (card.storyCues?.people && card.storyCues.people.length > 0) {
      addReportItemIfMissing(cues, {
        key: "family.cues.askPeople",
        values: {
          person: card.storyCues.people[0],
          fallback: `Ask about other moments with ${card.storyCues.people[0]}.`,
        },
      });
    }

    if (card.placeTag) {
      addReportItemIfMissing(cues, {
        key: "family.cues.askPlace",
        values: {
          place: card.placeTag,
          fallback: `Ask what they might do first if they went to ${card.placeTag} again.`,
        },
      });
    } else if (card.storyCues?.places && card.storyCues.places.length > 0) {
      addReportItemIfMissing(cues, {
        key: "family.cues.askPlace",
        values: {
          place: card.storyCues.places[0],
          fallback: `Ask what they might do first if they went to ${card.storyCues.places[0]} again.`,
        },
      });
    }
  });

  return cues.slice(0, 6);
}

function buildRoutineTrendSummary(routineResults: RoutineResult[], now: Date): RoutineParticipationSummary {
  const nowTime = now.getTime();
  const thisWindowStart = nowTime - WINDOW_DAYS * ONE_DAY_MS;
  const previousWindowStart = thisWindowStart - WINDOW_DAYS * ONE_DAY_MS;

  let attemptedThisWindow = 0;
  let attemptedPreviousWindow = 0;
  let completedThisWindow = 0;
  let completedPreviousWindow = 0;
  let lastCompletedTime: number | null = null;

  routineResults.forEach((result) => {
    const timestamp = parseIsoDate(result.timestamp);
    if (timestamp === null || timestamp > nowTime) {
      return;
    }

    if (timestamp >= thisWindowStart) {
      attemptedThisWindow += 1;
      if (result.completed) {
        completedThisWindow += 1;
        if (lastCompletedTime === null || timestamp > lastCompletedTime) {
          lastCompletedTime = timestamp;
        }
      }
    } else if (timestamp >= previousWindowStart) {
      attemptedPreviousWindow += 1;
      if (result.completed) {
        completedPreviousWindow += 1;
      }
    }
  });

  const trendDirection: RoutineTrendDirection =
    attemptedThisWindow > attemptedPreviousWindow
      ? "up"
      : attemptedThisWindow < attemptedPreviousWindow
        ? "down"
        : "flat";

  const participationRateThisWindow =
    attemptedThisWindow > 0
      ? Math.round((completedThisWindow / attemptedThisWindow) * 100)
      : 0;

  return {
    completedThisWindow,
    completedPreviousWindow,
    attemptedThisWindow,
    attemptedPreviousWindow,
    trendDirection,
    trendSummaryCopy: {
      key: TREND_KEY_MAP[trendDirection],
      values: {
        thisWindow: attemptedThisWindow,
        previousWindow: attemptedPreviousWindow,
      },
    },
    participationRateThisWindow,
  };
}

function buildStrengths(
  overview: CaregiverCounselorOverview,
  routineTrend: RoutineParticipationSummary
): ReportCopyItem[] {
  const strengths: ReportCopyItem[] = [];

  if (overview.completedRoutines > 0) {
    addReportItemIfMissing(strengths, {
      key: "family.report.strengths.routines",
      values: {
        count: overview.completedRoutines,
      },
    });
  }

  if (overview.completionRate >= 0.5) {
    addReportItemIfMissing(strengths, {
      key: "family.report.strengths.consistency",
      values: {
        completionRate: Math.round(overview.completionRate * 100),
      },
    });
  }

  if (overview.shareableMemoryCount > 0) {
    addReportItemIfMissing(strengths, {
      key: "family.report.strengths.sharedMemories",
      values: {
        shareableMemoryCount: overview.shareableMemoryCount,
      },
    });
  }

  if (overview.dueMemoryCount === 0 && overview.totalMemoryCards > 0) {
    addReportItemIfMissing(strengths, {
      key: "family.report.strengths.reviewCadence",
    });
  }

  if (routineTrend.trendDirection === "up") {
    addReportItemIfMissing(strengths, {
      key: "family.report.strengths.routineMomentum",
    });
  }

  if (strengths.length === 0) {
    addReportItemIfMissing(strengths, {
      key: "family.report.strengths.gentleStart",
    });
  }

  return strengths;
}

function getLatestCaregiverObservation(
  observationRecords: CaregiverObservationRecord[],
  now: Date,
): CaregiverObservationRecord | undefined {
  const nowTime = now.getTime();

  return observationRecords
    .map((record) => ({
      record,
      timestamp: parseIsoDate(record.createdAt),
    }))
    .filter((entry): entry is { record: CaregiverObservationRecord; timestamp: number } =>
      entry.timestamp !== null && entry.timestamp <= nowTime,
    )
    .sort((a, b) => b.timestamp - a.timestamp)[0]?.record;
}

function buildObservationSuggestedTopics(
  observationRecords: CaregiverObservationRecord[],
  now: Date,
): ReportCopyItem[] {
  const latestObservation = getLatestCaregiverObservation(observationRecords, now);
  const suggestions: ReportCopyItem[] = [];

  if (!latestObservation) {
    return suggestions;
  }

  latestObservation.selectedDomains.forEach((domain) => {
    const response = latestObservation.domainResponses[domain];

    if (!response || response === "aboutSame") {
      return;
    }

    addReportItemIfMissing(suggestions, {
      key:
        response === "notSure"
          ? "family.report.nextTopics.observationUncertain"
          : OBSERVATION_TOPIC_KEY_MAP[domain],
    });
  });

  return suggestions.slice(0, 3);
}

function buildSuggestedTopics(
  cards: MemoryCard[],
  overview: CaregiverCounselorOverview,
  routineTrend: RoutineParticipationSummary,
  observationRecords: CaregiverObservationRecord[],
  now: Date,
): ReportCopyItem[] {
  const shareableCards = cards.filter((card) => card.shareWithFamily);
  const suggestions: ReportCopyItem[] = [];

  buildObservationSuggestedTopics(observationRecords, now).forEach((item) =>
    addReportItemIfMissing(suggestions, item),
  );

  if (shareableCards.length === 0) {
    addReportItemIfMissing(suggestions, {
      key: "family.report.nextTopics.shareableSeed",
      values: {
        fallback: "Start by saving one short memory with sharing enabled.",
      },
    });
  }

  const topicCounts = new Map<string, number>();
  shareableCards.forEach((card) => {
    if (card.topic) {
      topicCounts.set(card.topic, (topicCounts.get(card.topic) || 0) + 1);
    }
  });

  topicCounts.forEach((count, topic) => {
    addReportItemIfMissing(suggestions, {
      key: "family.report.nextTopics.topic",
      values: {
        topic,
        count,
      },
    });
  });

  if (overview.dueMemoryCount > 0) {
    addReportItemIfMissing(suggestions, {
      key: "family.report.nextTopics.reviewDue",
      values: {
        count: overview.dueMemoryCount,
      },
    });
  }

  if (routineTrend.trendDirection === "down") {
    addReportItemIfMissing(suggestions, {
      key: "family.report.nextTopics.routineConsistency",
      values: {
        thisWindow: routineTrend.attemptedThisWindow,
        previousWindow: routineTrend.attemptedPreviousWindow,
      },
    });
  }

  if (routineTrend.trendDirection === "up") {
    addReportItemIfMissing(suggestions, {
      key: "family.report.nextTopics.routineMomentum",
    });
  }

  if (overview.shareableMemoryCount > 0 && overview.dueMemoryCount === 0) {
    addReportItemIfMissing(suggestions, {
      key: "family.report.nextTopics.prepareConversation",
    });
  }

  return suggestions.slice(0, 5);
}

export function generateCaregiverCounselorReport(
  memoryCards: MemoryCard[],
  routineResults: RoutineResult[],
  now = new Date(),
  caregiverObservationRecords: CaregiverObservationRecord[] = [],
): CaregiverCounselorReport {
  const safeCards = memoryCards ?? [];
  const safeRoutineResults = routineResults ?? [];
  const safeCaregiverObservationRecords = caregiverObservationRecords ?? [];

  const dueMemoryCards = safeCards.filter((card) => {
    const dueAt = parseIsoDate(card.reviewState?.dueAt);
    return dueAt !== null && dueAt <= now.getTime();
  });

  const shareableMemoryCards = safeCards.filter((card) => card.shareWithFamily);

  const completedRoutines = safeRoutineResults.filter((r) => r.completed).length;
  const routineParticipation = buildRoutineTrendSummary(safeRoutineResults, now);

  const completionRate =
    safeRoutineResults.length > 0 ? completedRoutines / safeRoutineResults.length : 0;

  let lastPracticeDate: string | undefined;
  const nowTime = now.getTime();
  const lastCompletedResult = safeRoutineResults
    .filter((result) => result.completed)
    .map((result) => parseIsoDate(result.timestamp))
    .filter((value): value is number => value !== null && value <= nowTime)
    .sort((a, b) => b - a)[0];

  if (lastCompletedResult) {
    lastPracticeDate = new Date(lastCompletedResult).toISOString();
  }

  const overview: CaregiverCounselorOverview = {
    totalRoutines: safeRoutineResults.length,
    completedRoutines,
    completionRate,
    totalMemoryCards: safeCards.length,
    dueMemoryCount: dueMemoryCards.length,
    shareableMemoryCount: shareableMemoryCards.length,
    metrics: [
      {
        key: "family.routinesCompleted",
        values: { count: completedRoutines },
      },
      {
        key: "family.dueMemoryCards",
        values: { count: dueMemoryCards.length },
      },
      {
        key: "family.sharedMemoryCards",
        values: { count: shareableMemoryCards.length },
      },
    ],
    lastPracticeDate,
  };

  const conversationCues = buildConversationCues(safeCards);
  const activityHighlights = buildActivityHighlights(safeRoutineResults, now);
  const strengths = buildStrengths(overview, routineParticipation);
  const suggestedNextConversationTopics = buildSuggestedTopics(
    safeCards,
    overview,
    routineParticipation,
    safeCaregiverObservationRecords,
    now,
  );
  const advisory = generateHaruAdvisorySummary(
    safeCards,
    safeRoutineResults,
    safeCaregiverObservationRecords,
    now,
  );

  return {
    overview,
    routineTrend: routineParticipation,
    advisory,
    dueMemoryCount: dueMemoryCards.length,
    shareableMemoryCount: shareableMemoryCards.length,
    activityHighlights,
    conversationCues,
    strengths,
    suggestedNextConversationTopics,
    safetyDisclaimerCopyKeys: SAFETY_COPY_KEYS,
  };
}

