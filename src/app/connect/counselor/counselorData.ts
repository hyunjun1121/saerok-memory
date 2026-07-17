import {
  HARU_DEMO_PERSONA,
  HARU_WEEK_PLAN,
  HARU_WEEK_QUESTION_META,
  type HaruWeekDay,
  type HaruWeekQuestionMeta,
} from "@/data/haru7DayExercises";
import type {
  HaruDemoResponse,
  HaruDemoSession,
} from "@/features/lessons/haruDemoSessionStorage";
import type { LocalizedText } from "@/utils/localizedText";

// Sanitized browser view-model built only from validated local Haru sessions.
// Raw transcripts, annotations, answer options, button events, and audio
// references never cross this aggregate boundary.

export type Status = "done" | "partial" | "none";

export type PracticeAreaKey =
  | "areaOrientation"
  | "areaPriorDayRecall"
  | "areaPersonalRecall"
  | "areaAttentionCalculation"
  | "areaLanguage"
  | "areaVisuospatial"
  | "areaSequence";

export interface PracticeAreaSummary {
  key: PracticeAreaKey;
  expectedMatches: number;
  evaluatedActivities: number;
}

export interface DailyParticipationRecord {
  day: HaruWeekDay;
  weekdayKey:
    | "weekdayMon"
    | "weekdayTue"
    | "weekdayWed"
    | "weekdayThu"
    | "weekdayFri"
    | "weekdaySat"
    | "weekdaySun";
  status: Status;
  activitiesCompleted: number;
  activitiesExpected: number;
  expectedMatches: number;
  evaluatedActivities: number;
  sessionSeconds: number;
  voiceCaptured: boolean;
}

export interface Participant {
  id: number;
  name: LocalizedText;
  age: number;
  residence: LocalizedText;
  livingArrangement: LocalizedText;
  speechProfileNote: LocalizedText;
  hometown: LocalizedText;
  formerOccupation: LocalizedText;
  status: Status;
  pct: number;
  completedSessions: number;
  expectedSessions: number;
  activityCount: number;
  evaluatedActivities: number;
  expectedMatches: number;
  voiceRecords: number;
  profileBasedQuestions: number;
  priorResponseQuestions: number;
  moodResponses: number;
  priorRecallResponses: number;
  sequenceEvaluated: number;
  sequenceDifferences: number;
  averageSessionSeconds: number;
  averageChoiceResponseSeconds: number;
  averageVoiceDurationSeconds: number;
  sttCompleted: number;
  sttAverageConfidence: number | null;
  participation: boolean[];
  dailyRecords: DailyParticipationRecord[];
  practiceAreas: PracticeAreaSummary[];
  familySharingConsent: boolean;
  shareableMemoryCount: number;
  isSynthetic: boolean;
  hasLiveRecords: boolean;
}

interface ValidatedResponse {
  response: HaruDemoResponse;
  question: HaruWeekQuestionMeta;
}

type PersonalizationKind = "profile" | "prior_question";

const WEEKDAY_KEYS: DailyParticipationRecord["weekdayKey"][] = [
  "weekdayMon",
  "weekdayTue",
  "weekdayWed",
  "weekdayThu",
  "weekdayFri",
  "weekdaySat",
  "weekdaySun",
];

const PRACTICE_AREA_DOMAINS: readonly {
  key: PracticeAreaKey;
  domains: readonly string[];
}[] = [
  { key: "areaOrientation", domains: ["시간 지남력"] },
  { key: "areaPriorDayRecall", domains: ["전날 활동 회상"] },
  {
    key: "areaPersonalRecall",
    domains: ["일반 개인 기억", "장기·주간 개인 기억"],
  },
  {
    key: "areaAttentionCalculation",
    domains: ["주의·계산", "개인화 주의·계산"],
  },
  { key: "areaLanguage", domains: ["언어 이해"] },
  { key: "areaVisuospatial", domains: ["시공간·주의", "시공간"] },
  { key: "areaSequence", domains: ["단어·순서 기억"] },
];

const questionById = new Map(
  HARU_WEEK_QUESTION_META.map((question) => [question.exerciseId, question] as const),
);

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isHaruWeekDay(value: unknown): value is HaruWeekDay {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 7;
}

function isSessionStatus(value: unknown): value is HaruDemoSession["status"] {
  return value === "in_progress" || value === "completed" || value === "abandoned";
}

function isUsableSession(session: HaruDemoSession): boolean {
  return (
    isHaruWeekDay(session.day) &&
    isSessionStatus(session.status) &&
    Array.isArray(session.questionIds) &&
    Array.isArray(session.responses)
  );
}

function sessionTimestamp(session: HaruDemoSession): number {
  const timestamp = new Date(session.startedAt).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function selectLatestSessions(
  sessions: readonly HaruDemoSession[],
): Map<HaruWeekDay, HaruDemoSession> {
  const byDay = new Map<HaruWeekDay, HaruDemoSession>();

  for (const session of sessions) {
    if (!session || !isUsableSession(session)) continue;
    const existing = byDay.get(session.day);
    if (!existing || sessionTimestamp(session) >= sessionTimestamp(existing)) {
      byDay.set(session.day, session);
    }
  }

  return byDay;
}

function validateResponses(session: HaruDemoSession): ValidatedResponse[] {
  const allowedQuestionIds = new Set(session.questionIds);
  const responseByQuestion = new Map<string, ValidatedResponse>();

  for (const response of session.responses) {
    if (!response || !allowedQuestionIds.has(response.questionId)) continue;
    const question = questionById.get(response.questionId);
    if (
      !question ||
      question.day !== session.day ||
      question.responseType !== response.responseType ||
      !isFiniteNonNegative(response.responseTimeMs) ||
      (typeof response.isCorrect !== "boolean" && response.isCorrect !== null)
    ) {
      continue;
    }

    responseByQuestion.set(response.questionId, { response, question });
  }

  return HARU_WEEK_PLAN[session.day - 1].exerciseIds.flatMap((questionId) => {
    const validated = responseByQuestion.get(questionId);
    return validated ? [validated] : [];
  });
}

function personalizationKindFor({
  response,
  question,
}: ValidatedResponse): PersonalizationKind | undefined {
  const explicitKind = response.personalization?.kind;
  if (explicitKind === "profile") return "profile";
  if (explicitKind === "prior_response") return "prior_question";
  if (explicitKind !== undefined) return undefined;
  return question.scriptedSource?.kind;
}

function practiceArea(
  key: PracticeAreaKey,
  domains: readonly string[],
  responses: readonly ValidatedResponse[],
): PracticeAreaSummary {
  const evaluated = responses.filter(
    ({ response, question }) =>
      question.scored &&
      domains.includes(question.domain) &&
      typeof response.isCorrect === "boolean",
  );
  return {
    key,
    evaluatedActivities: evaluated.length,
    expectedMatches: evaluated.filter(({ response }) => response.isCorrect === true).length,
  };
}

export function buildHaruParticipant(
  sessions: readonly HaruDemoSession[],
): Participant {
  const sessionsByDay = selectLatestSessions(sessions);
  const responsesByDay = new Map<HaruWeekDay, ValidatedResponse[]>();
  for (const [day, session] of sessionsByDay) {
    responsesByDay.set(day, validateResponses(session));
  }

  const dailyRecords: DailyParticipationRecord[] = HARU_WEEK_PLAN.map((plan, index) => {
    const session = sessionsByDay.get(plan.day);
    const responses = responsesByDay.get(plan.day) ?? [];
    const evaluated = responses.filter(
      ({ response, question }) => question.scored && typeof response.isCorrect === "boolean",
    );
    const voiceCaptured = responses.some(
      ({ response, question }) =>
        question.responseType === "voice" &&
        isFiniteNonNegative(response.voiceDurationSeconds) &&
        response.voiceDurationSeconds > 0,
    );

    return {
      day: plan.day,
      weekdayKey: WEEKDAY_KEYS[index],
      status: session
        ? session.status === "completed"
          ? "done"
          : "partial"
        : "none",
      activitiesCompleted: responses.length,
      activitiesExpected: plan.exerciseIds.length,
      expectedMatches: evaluated.filter(({ response }) => response.isCorrect === true).length,
      evaluatedActivities: evaluated.length,
      sessionSeconds: isFiniteNonNegative(session?.durationSeconds)
        ? session.durationSeconds
        : 0,
      voiceCaptured,
    };
  });

  const responses = HARU_WEEK_PLAN.flatMap(
    (plan) => responsesByDay.get(plan.day) ?? [],
  );
  const evaluated = responses.filter(
    ({ response, question }) => question.scored && typeof response.isCorrect === "boolean",
  );
  const choiceResponses = responses.filter(
    ({ question }) => question.responseType !== "voice",
  );
  const capturedVoiceResponses = responses.filter(
    ({ response, question }) =>
      question.responseType === "voice" &&
      isFiniteNonNegative(response.voiceDurationSeconds) &&
      response.voiceDurationSeconds > 0,
  );
  const voiceResponses = responses.filter(
    ({ question }) => question.responseType === "voice",
  );
  const sttConfidenceValues = voiceResponses.flatMap(({ response }) => {
    const confidence = response.sttConfidence;
    return typeof confidence === "number" &&
      Number.isFinite(confidence) &&
      confidence >= 0 &&
      confidence <= 1
      ? [confidence]
      : [];
  });
  const completedSessions = dailyRecords.filter((record) => record.status === "done").length;
  const expectedSessions = HARU_WEEK_PLAN.length;
  const hasLiveRecords = sessionsByDay.size > 0;
  const sequenceResponses = evaluated.filter(
    ({ question }) => question.responseType === "button_sequence",
  );

  return {
    id: 1,
    name: HARU_DEMO_PERSONA.name,
    age: HARU_DEMO_PERSONA.age,
    residence: HARU_DEMO_PERSONA.residence,
    livingArrangement: HARU_DEMO_PERSONA.livingArrangement,
    speechProfileNote: HARU_DEMO_PERSONA.speechProfileNote,
    hometown: HARU_DEMO_PERSONA.registeredProfileFields.hometown,
    formerOccupation: HARU_DEMO_PERSONA.registeredProfileFields.formerOccupation,
    status:
      completedSessions === expectedSessions
        ? "done"
        : hasLiveRecords
          ? "partial"
          : "none",
    pct: Math.round((completedSessions / expectedSessions) * 100),
    completedSessions,
    expectedSessions,
    activityCount: responses.length,
    evaluatedActivities: evaluated.length,
    expectedMatches: evaluated.filter(({ response }) => response.isCorrect === true).length,
    voiceRecords: capturedVoiceResponses.length,
    profileBasedQuestions: responses.filter(
      (response) => personalizationKindFor(response) === "profile",
    ).length,
    priorResponseQuestions: responses.filter(
      (response) => personalizationKindFor(response) === "prior_question",
    ).length,
    moodResponses: responses.filter(({ question }) => question.domain === "감정").length,
    priorRecallResponses: responses.filter(
      ({ question }) => question.domain === "전날 활동 회상",
    ).length,
    sequenceEvaluated: sequenceResponses.length,
    sequenceDifferences: sequenceResponses.filter(
      ({ response }) => response.isCorrect === false,
    ).length,
    averageSessionSeconds: average(
      [...sessionsByDay.values()].flatMap((session) =>
        isFiniteNonNegative(session.durationSeconds) ? [session.durationSeconds] : [],
      ),
    ),
    averageChoiceResponseSeconds:
      average(choiceResponses.map(({ response }) => response.responseTimeMs)) / 1000,
    averageVoiceDurationSeconds: average(
      capturedVoiceResponses.map(({ response }) => response.voiceDurationSeconds as number),
    ),
    sttCompleted: voiceResponses.filter(
      ({ response }) => response.sttStatus === "completed",
    ).length,
    sttAverageConfidence:
      sttConfidenceValues.length > 0 ? average(sttConfidenceValues) : null,
    participation: dailyRecords.map((record) => record.status === "done"),
    dailyRecords,
    practiceAreas: PRACTICE_AREA_DOMAINS.map(({ key, domains }) =>
      practiceArea(key, domains, responses),
    ),
    familySharingConsent: HARU_DEMO_PERSONA.hasFamilySharingConsent,
    shareableMemoryCount: 0,
    isSynthetic: HARU_DEMO_PERSONA.isSynthetic,
    hasLiveRecords,
  };
}

export function getParticipant(
  id: number,
  sessions: readonly HaruDemoSession[],
): Participant | undefined {
  return id === 1 ? buildHaruParticipant(sessions) : undefined;
}
