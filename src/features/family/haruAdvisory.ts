import type { RoutineResult } from "@/features/cognitive/cognitiveRoutineStorage";
import type { MemoryCard } from "@/features/memory/types";
import type {
  CaregiverObservationDomain,
  CaregiverObservationRecord,
  CaregiverObservationResponse,
} from "@/features/family/caregiverObservationStorage";

export type HaruAdvisoryLevel = "steady" | "watch" | "needsConversation";

export type HaruAdvisoryDomain =
  | "participation"
  | "memory"
  | "attention"
  | "language"
  | "visuospatial"
  | "dailyFlow"
  | "caregiverObservation";

export type HaruDataCompleteness = "limited" | "usable" | "rich";

export interface HaruAdvisoryCopyItem {
  key: string;
  values?: Record<string, string | number>;
}

export interface HaruAdvisorySignal extends HaruAdvisoryCopyItem {
  domain: HaruAdvisoryDomain;
  level: HaruAdvisoryLevel;
  weight: number;
}

export interface HaruAdvisoryDomainSummary extends HaruAdvisoryCopyItem {
  domain: HaruAdvisoryDomain;
  level: HaruAdvisoryLevel;
  signalCount: number;
}

export interface HaruAdvisorySummary {
  level: HaruAdvisoryLevel;
  dataCompleteness: HaruDataCompleteness;
  summary: HaruAdvisoryCopyItem;
  domainSummaries: HaruAdvisoryDomainSummary[];
  signals: HaruAdvisorySignal[];
  nextSteps: HaruAdvisoryCopyItem[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WINDOW_DAYS = 7;
const OBSERVATION_WINDOW_DAYS = 30;

const RESPONSE_WEIGHT: Record<CaregiverObservationResponse, number> = {
  aboutSame: 0,
  occasionallyDifferent: 1,
  oftenDifferent: 2,
  notSure: 1,
};

const OBSERVATION_DOMAIN_MAP: Record<CaregiverObservationDomain, HaruAdvisoryDomain> = {
  dailyRoutine: "dailyFlow",
  conversation: "language",
  appointments: "memory",
  navigation: "visuospatial",
  medicationMoney: "dailyFlow",
  moodSocial: "caregiverObservation",
  sleepAppetite: "caregiverObservation",
  homeSafety: "dailyFlow",
};

function parseIsoDate(value?: string): number | null {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function getMetadataNumber(result: RoutineResult | undefined, key: string): number | null {
  const value = result?.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getMetadataBoolean(result: RoutineResult | undefined, key: string): boolean | null {
  const value = result?.metadata?.[key];
  return typeof value === "boolean" ? value : null;
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

function addSignal(signals: HaruAdvisorySignal[], signal: HaruAdvisorySignal): void {
  const duplicate = signals.some(
    (existing) => existing.domain === signal.domain && existing.key === signal.key,
  );

  if (!duplicate) {
    signals.push(signal);
  }
}

function getLevelWeight(level: HaruAdvisoryLevel): number {
  if (level === "needsConversation") {
    return 2;
  }

  if (level === "watch") {
    return 1;
  }

  return 0;
}

function deriveOverallLevel(signals: HaruAdvisorySignal[]): HaruAdvisoryLevel {
  const weightedTotal = signals.reduce((total, signal) => total + signal.weight, 0);
  const hasConversationSignal = signals.some((signal) => signal.level === "needsConversation");

  if (hasConversationSignal || weightedTotal >= 4) {
    return "needsConversation";
  }

  if (weightedTotal > 0) {
    return "watch";
  }

  return "steady";
}

function deriveDataCompleteness(
  memoryCards: MemoryCard[],
  routineResults: RoutineResult[],
  observationRecords: CaregiverObservationRecord[],
): HaruDataCompleteness {
  const shareableMemoryCount = memoryCards.filter((card) => card.shareWithFamily).length;
  const evidencePoints = routineResults.length + shareableMemoryCount + observationRecords.length * 2;

  if (evidencePoints >= 24) {
    return "rich";
  }

  if (evidencePoints >= 8) {
    return "usable";
  }

  return "limited";
}

function addParticipationSignals(
  signals: HaruAdvisorySignal[],
  routineResults: RoutineResult[],
  now: Date,
): void {
  const nowTime = now.getTime();
  const recentStart = nowTime - RECENT_WINDOW_DAYS * DAY_MS;
  const previousStart = recentStart - RECENT_WINDOW_DAYS * DAY_MS;

  let recentAttempts = 0;
  let previousAttempts = 0;
  let recentCompleted = 0;

  routineResults.forEach((result) => {
    const timestamp = parseIsoDate(result.timestamp);
    if (timestamp === null || timestamp > nowTime) {
      return;
    }

    if (timestamp >= recentStart) {
      recentAttempts += 1;
      if (result.completed) {
        recentCompleted += 1;
      }
    } else if (timestamp >= previousStart) {
      previousAttempts += 1;
    }
  });

  if (previousAttempts >= 3 && recentAttempts === 0) {
    addSignal(signals, {
      domain: "participation",
      level: "needsConversation",
      weight: 2,
      key: "family.advisory.signals.participationStopped",
      values: { previous: previousAttempts },
    });
  } else if (previousAttempts >= 3 && recentAttempts < previousAttempts) {
    addSignal(signals, {
      domain: "participation",
      level: "watch",
      weight: 1,
      key: "family.advisory.signals.participationLower",
      values: { recent: recentAttempts, previous: previousAttempts },
    });
  }

  if (recentAttempts >= 3) {
    const recentCompletionRate = recentCompleted / recentAttempts;
    if (recentCompletionRate < 0.5) {
      addSignal(signals, {
        domain: "participation",
        level: "watch",
        weight: 1,
        key: "family.advisory.signals.completionLower",
        values: { percent: Math.round(recentCompletionRate * 100) },
      });
    }
  }
}

function addRoutineSignals(
  signals: HaruAdvisorySignal[],
  routineResults: RoutineResult[],
  now: Date,
): void {
  const latestWordRecall = getLatestCompletedResult(routineResults, "delayed_word_recall", now);
  const wordRecallCorrect =
    getMetadataNumber(latestWordRecall, "correctCount") ??
    getMetadataNumber(latestWordRecall, "wordRecallCorrect");
  const wordRecallTarget =
    getMetadataNumber(latestWordRecall, "targetCount") ??
    getMetadataNumber(latestWordRecall, "wordCount") ??
    5;

  if (wordRecallCorrect !== null && wordRecallTarget > 0) {
    const ratio = wordRecallCorrect / wordRecallTarget;
    // Conservative (SP-08): a single low recall session is only a "watch" cue.
    // needsConversation is reserved for repeated/compound signals (e.g. a
    // stopped participation trend or a caregiver "often different" observation).
    if (ratio < 0.4) {
      addSignal(signals, {
        domain: "memory",
        level: "watch",
        weight: 1,
        key: "family.advisory.signals.wordRecallLow",
        values: { correct: wordRecallCorrect, target: wordRecallTarget },
      });
    } else if (ratio < 0.7) {
      addSignal(signals, {
        domain: "memory",
        level: "watch",
        weight: 1,
        key: "family.advisory.signals.wordRecallWatch",
        values: { correct: wordRecallCorrect, target: wordRecallTarget },
      });
    }
  }

  const latestDigitSpan = getLatestCompletedResult(routineResults, "digit_span_practice", now);
  const digitMisses =
    getMetadataNumber(latestDigitSpan, "missCount") ??
    getMetadataNumber(latestDigitSpan, "errorCount");
  const digitSpanLength =
    getMetadataNumber(latestDigitSpan, "spanLength") ??
    getMetadataNumber(latestDigitSpan, "digitSpanLength");

  if (digitMisses !== null && digitMisses >= 2) {
    addSignal(signals, {
      domain: "attention",
      level: "watch",
      weight: 1,
      key: "family.advisory.signals.digitSpanMisses",
      values: { count: digitMisses },
    });
  } else if (digitSpanLength !== null && digitSpanLength <= 2) {
    addSignal(signals, {
      domain: "attention",
      level: "watch",
      weight: 1,
      key: "family.advisory.signals.digitSpanShort",
      values: { length: digitSpanLength },
    });
  }

  const latestVerbalFluency = getLatestCompletedResult(routineResults, "verbal_fluency_practice", now);
  const verbalUnique =
    getMetadataNumber(latestVerbalFluency, "uniqueCount") ??
    getMetadataNumber(latestVerbalFluency, "verbalFluencyUniqueCount");
  if (verbalUnique !== null && verbalUnique < 5) {
    addSignal(signals, {
      domain: "language",
      level: "watch",
      weight: 1,
      key: "family.advisory.signals.verbalFluencyLow",
      values: { count: verbalUnique },
    });
  }

  const latestTrail = getLatestCompletedResult(routineResults, "trail_switching_practice", now);
  const trailErrors =
    getMetadataNumber(latestTrail, "errorCount") ??
    getMetadataNumber(latestTrail, "trailSwitchingErrors");
  if (trailErrors !== null && trailErrors >= 3) {
    addSignal(signals, {
      domain: "attention",
      level: "watch",
      weight: 1,
      key: "family.advisory.signals.trailErrors",
      values: { count: trailErrors },
    });
  }

  const latestStroop = getLatestCompletedResult(routineResults, "stroop_touch_practice", now);
  const stroopErrors = getMetadataNumber(latestStroop, "errorCount");
  const averageResponseMs = getMetadataNumber(latestStroop, "averageResponseMs");
  if ((stroopErrors !== null && stroopErrors >= 2) || (averageResponseMs !== null && averageResponseMs >= 2500)) {
    addSignal(signals, {
      domain: "attention",
      level: "watch",
      weight: 1,
      key: "family.advisory.signals.colorFocus",
      values: {
        errors: stroopErrors ?? "-",
        seconds: averageResponseMs !== null ? Math.round(averageResponseMs / 100) / 10 : "-",
      },
    });
  }

  const latestOrientation = getLatestCompletedResult(routineResults, "orientation_practice", now);
  const orientationMatched =
    getMetadataBoolean(latestOrientation, "matchedExpected") ??
    getMetadataBoolean(latestOrientation, "orientationMatched");
  if (orientationMatched === false) {
    addSignal(signals, {
      domain: "dailyFlow",
      level: "watch",
      weight: 1,
      key: "family.advisory.signals.orientationMismatch",
    });
  }

  const latestDrawing = getLatestCompletedResult(routineResults, "shape_copy_practice", now);
  const drawingClearCount = getMetadataNumber(latestDrawing, "drawingClearCount");
  const drawingDurationMs =
    getMetadataNumber(latestDrawing, "drawingDurationMs") ??
    getMetadataNumber(latestDrawing, "durationMs");
  if ((drawingClearCount !== null && drawingClearCount >= 2) || (drawingDurationMs !== null && drawingDurationMs >= 45000)) {
    addSignal(signals, {
      domain: "visuospatial",
      level: "watch",
      weight: 1,
      key: "family.advisory.signals.drawingHesitation",
      values: {
        clearCount: drawingClearCount ?? "-",
        seconds: drawingDurationMs !== null ? Math.round(drawingDurationMs / 1000) : "-",
      },
    });
  }
}

function addObservationSignals(
  signals: HaruAdvisorySignal[],
  observationRecords: CaregiverObservationRecord[],
  now: Date,
): void {
  const cutoff = now.getTime() - OBSERVATION_WINDOW_DAYS * DAY_MS;
  const recentRecords = observationRecords.filter((record) => {
    const timestamp = parseIsoDate(record.createdAt);
    return timestamp !== null && timestamp >= cutoff && timestamp <= now.getTime();
  });

  const strongestByDomain = new Map<CaregiverObservationDomain, CaregiverObservationResponse>();

  recentRecords.forEach((record) => {
    record.selectedDomains.forEach((domain) => {
      const response = record.domainResponses[domain];
      if (!response || response === "aboutSame") {
        return;
      }

      const current = strongestByDomain.get(domain);
      if (!current || RESPONSE_WEIGHT[response] > RESPONSE_WEIGHT[current]) {
        strongestByDomain.set(domain, response);
      }
    });
  });

  // SP-09: needsConversation is reserved for a repeated (>=2) often-different
  // concern across domains — never from a single caregiver observation.
  const hasRepeatedConcern =
    [...strongestByDomain.entries()].filter(([, response]) => response === "oftenDifferent")
      .length >= 2;

  strongestByDomain.forEach((response, observationDomain) => {
    const domain = OBSERVATION_DOMAIN_MAP[observationDomain];
    const level: HaruAdvisoryLevel =
      response === "oftenDifferent" && hasRepeatedConcern ? "needsConversation" : "watch";
    addSignal(signals, {
      domain,
      level,
      weight: level === "needsConversation" ? 2 : 1,
      key:
        response === "notSure"
          ? "family.advisory.signals.observationUncertain"
          : "family.advisory.signals.observationChanged",
      values: {
        domain: `family.observation.domains.${observationDomain}`,
        response: `family.observation.responses.${response}`,
      },
    });
  });
}

function buildDomainSummaries(signals: HaruAdvisorySignal[]): HaruAdvisoryDomainSummary[] {
  const domains: HaruAdvisoryDomain[] = [
    "participation",
    "memory",
    "attention",
    "language",
    "visuospatial",
    "dailyFlow",
    "caregiverObservation",
  ];

  return domains.map((domain) => {
    const domainSignals = signals.filter((signal) => signal.domain === domain);
    const strongestLevel = domainSignals
      .map((signal) => signal.level)
      .sort((a, b) => getLevelWeight(b) - getLevelWeight(a))[0] ?? "steady";

    return {
      domain,
      level: strongestLevel,
      signalCount: domainSignals.length,
      key:
        domainSignals.length > 0
          ? "family.advisory.domainSummaries.withSignals"
          : "family.advisory.domainSummaries.steady",
      values: {
        domain: `family.advisory.domains.${domain}`,
        count: domainSignals.length,
        level: `family.advisory.levels.${strongestLevel}`,
      },
    };
  });
}

function buildNextSteps(level: HaruAdvisoryLevel, signals: HaruAdvisorySignal[]): HaruAdvisoryCopyItem[] {
  const steps: HaruAdvisoryCopyItem[] = [];
  const domains = new Set(signals.map((signal) => signal.domain));

  if (level === "steady") {
    steps.push({ key: "family.advisory.nextSteps.keepRoutine" });
  } else {
    steps.push({ key: "family.advisory.nextSteps.prepareConversation" });
  }

  if (level === "needsConversation") {
    steps.push({ key: "family.advisory.nextSteps.professionalConversation" });
  }

  if (domains.has("memory")) {
    steps.push({ key: "family.advisory.nextSteps.memoryCue" });
  }

  if (domains.has("attention") || domains.has("visuospatial")) {
    steps.push({ key: "family.advisory.nextSteps.simplifyRoutine" });
  }

  if (domains.has("dailyFlow") || domains.has("caregiverObservation")) {
    steps.push({ key: "family.advisory.nextSteps.caregiverCheck" });
  }

  return steps.slice(0, 4);
}

export function generateHaruAdvisorySummary(
  memoryCards: MemoryCard[],
  routineResults: RoutineResult[],
  observationRecords: CaregiverObservationRecord[] = [],
  now = new Date(),
): HaruAdvisorySummary {
  const safeMemoryCards = memoryCards ?? [];
  const safeRoutineResults = routineResults ?? [];
  const safeObservationRecords = observationRecords ?? [];
  const signals: HaruAdvisorySignal[] = [];

  addParticipationSignals(signals, safeRoutineResults, now);
  addRoutineSignals(signals, safeRoutineResults, now);
  addObservationSignals(signals, safeObservationRecords, now);

  const level = deriveOverallLevel(signals);
  const dataCompleteness = deriveDataCompleteness(
    safeMemoryCards,
    safeRoutineResults,
    safeObservationRecords,
  );

  const orderedSignals = signals.sort((a, b) => b.weight - a.weight);

  return {
    level,
    dataCompleteness,
    summary: {
      key: `family.advisory.summary.${level}`,
      values: {
        signalCount: orderedSignals.length,
      },
    },
    domainSummaries: buildDomainSummaries(orderedSignals),
    signals: orderedSignals,
    nextSteps: buildNextSteps(level, orderedSignals),
  };
}
