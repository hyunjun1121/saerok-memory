import {
  HARU_WEEK_QUESTION_META,
  getHaruWeekPlan,
  type HaruQuestionResponseType,
  type HaruWeekDay,
} from "@/data/haru7DayExercises";
import type { HaruDerivedAnnotation } from "@/features/lessons/haruResponseFacts";
import { readJsonArray, removeKey, writeJson } from "@/utils/safeStorage";

export const HARU_DEMO_SESSION_STORAGE_KEY = "haruDemoSessions";
export const HARU_DEMO_SESSION_UPDATED_EVENT = "haru:demo-sessions-updated";

export type HaruDemoSessionStatus = "in_progress" | "completed" | "abandoned";
export type HaruPersonalizationKind =
  | "none"
  | "profile"
  | "prior_response"
  | "fallback";

export interface HaruPersonalizationRecord {
  kind: HaruPersonalizationKind;
  sourceQuestionIds?: string[];
}

export interface HaruDemoResponse {
  questionId: string;
  responseType: HaruQuestionResponseType;
  selectedOptionId?: string;
  submittedSequence?: string[];
  responseTimeMs: number;
  isCorrect: boolean | null;
  voiceDurationSeconds?: number;
  sttStatus?: string;
  sttLanguage?: string;
  sttConfidence?: number;
  recognitionError?: string;
  derivedAnnotations?: HaruDerivedAnnotation[];
  personalization?: HaruPersonalizationRecord;
}

export interface HaruDemoSession {
  day: HaruWeekDay;
  status: HaruDemoSessionStatus;
  questionIds: string[];
  questionCount: number;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  completionMessage: string | null;
  responses: HaruDemoResponse[];
}

const RESPONSE_TYPES = new Set<HaruQuestionResponseType>([
  "single_choice",
  "voice",
  "button_sequence",
]);

const SESSION_STATUSES = new Set<HaruDemoSessionStatus>([
  "in_progress",
  "completed",
  "abandoned",
]);

const PERSONALIZATION_KINDS = new Set<HaruPersonalizationKind>([
  "none",
  "profile",
  "prior_response",
  "fallback",
]);

const QUESTION_META_BY_ID = new Map(
  HARU_WEEK_QUESTION_META.map((question) => [question.exerciseId, question] as const),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isHaruWeekDay(value: unknown): value is HaruWeekDay {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 7;
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function toIsoString(now: Date): string {
  return Number.isNaN(now.getTime()) ? new Date().toISOString() : now.toISOString();
}

function sanitizeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeLimitedString(value: unknown, maxLength: number): string | undefined {
  const sanitized = sanitizeString(value);
  return sanitized ? sanitized.slice(0, maxLength) : undefined;
}

function sanitizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value
    .map(sanitizeString)
    .filter((item): item is string => item !== undefined);
  return strings.length > 0 ? strings : undefined;
}

function sanitizeNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function sanitizeConfidence(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : undefined;
}

function sanitizeAnnotations(value: unknown): HaruDerivedAnnotation[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const annotations: HaruDerivedAnnotation[] = [];
  const seen = new Set<string>();
  for (const candidate of value.slice(0, 24)) {
    if (!isRecord(candidate)) continue;
    const entityType = sanitizeLimitedString(candidate.entityType, 40);
    const annotationValue = sanitizeLimitedString(candidate.value, 120);
    if (!entityType || !annotationValue) continue;
    const key = `${entityType}\u0000${annotationValue}`;
    if (seen.has(key)) continue;
    seen.add(key);
    annotations.push({ entityType, value: annotationValue });
  }
  return annotations.length > 0 ? annotations : undefined;
}

function sanitizePersonalization(value: unknown): HaruPersonalizationRecord | undefined {
  if (!isRecord(value) || typeof value.kind !== "string") return undefined;
  if (!PERSONALIZATION_KINDS.has(value.kind as HaruPersonalizationKind)) {
    return undefined;
  }
  const sourceQuestionIds = sanitizeStringArray(value.sourceQuestionIds);
  return {
    kind: value.kind as HaruPersonalizationKind,
    ...(sourceQuestionIds ? { sourceQuestionIds } : {}),
  };
}

function sanitizeResponse(value: unknown): HaruDemoResponse | null {
  if (!isRecord(value)) return null;

  const questionId = sanitizeString(value.questionId);
  const responseType = value.responseType;
  const responseTimeMs = sanitizeNonNegativeNumber(value.responseTimeMs);
  const isCorrect = value.isCorrect;

  if (
    !questionId ||
    typeof responseType !== "string" ||
    !RESPONSE_TYPES.has(responseType as HaruQuestionResponseType) ||
    responseTimeMs === undefined ||
    (typeof isCorrect !== "boolean" && isCorrect !== null)
  ) {
    return null;
  }

  const selectedOptionId = sanitizeString(value.selectedOptionId);
  const submittedSequence = sanitizeStringArray(value.submittedSequence);
  const voiceDurationSeconds = sanitizeNonNegativeNumber(value.voiceDurationSeconds);
  const sttStatus = sanitizeString(value.sttStatus);
  const sttLanguage = sanitizeString(value.sttLanguage);
  const sttConfidence = sanitizeConfidence(value.sttConfidence);
  const recognitionError = sanitizeString(value.recognitionError);
  const derivedAnnotations =
    sanitizeAnnotations(value.derivedAnnotations) ??
    sanitizeStringArray(value.derivedAnnotationValues)?.map((annotationValue) => ({
      entityType: "핵심어",
      value: annotationValue,
    }));
  const personalization = sanitizePersonalization(value.personalization);

  return {
    questionId,
    responseType: responseType as HaruQuestionResponseType,
    responseTimeMs,
    isCorrect,
    ...(selectedOptionId ? { selectedOptionId } : {}),
    ...(submittedSequence ? { submittedSequence } : {}),
    ...(voiceDurationSeconds !== undefined ? { voiceDurationSeconds } : {}),
    ...(sttStatus ? { sttStatus } : {}),
    ...(sttLanguage ? { sttLanguage } : {}),
    ...(sttConfidence !== undefined ? { sttConfidence } : {}),
    ...(recognitionError ? { recognitionError } : {}),
    ...(derivedAnnotations ? { derivedAnnotations } : {}),
    ...(personalization ? { personalization } : {}),
  };
}

function hasRequiredResponsePayload(response: HaruDemoResponse): boolean {
  switch (response.responseType) {
    case "single_choice":
      return response.selectedOptionId !== undefined;
    case "button_sequence":
      return Boolean(response.submittedSequence?.length);
    case "voice":
      return (
        response.voiceDurationSeconds !== undefined && response.sttStatus !== undefined
      );
  }
}

function hasExactValidResponseSet(session: HaruDemoSession): boolean {
  const canonicalQuestionIds = getHaruWeekPlan(session.day).exerciseIds;
  if (
    session.questionIds.length !== canonicalQuestionIds.length ||
    session.questionIds.some(
      (questionId, index) => questionId !== canonicalQuestionIds[index],
    ) ||
    session.responses.length !== session.questionIds.length
  ) {
    return false;
  }

  const responseByQuestion = new Map<string, HaruDemoResponse>();
  for (const response of session.responses) {
    const question = QUESTION_META_BY_ID.get(response.questionId);
    if (
      !question ||
      question.day !== session.day ||
      question.responseType !== response.responseType ||
      !hasRequiredResponsePayload(response) ||
      responseByQuestion.has(response.questionId)
    ) {
      return false;
    }
    responseByQuestion.set(response.questionId, response);
  }

  return session.questionIds.every((questionId) => {
    const question = QUESTION_META_BY_ID.get(questionId);
    return (
      question?.day === session.day && responseByQuestion.has(questionId)
    );
  });
}

function sanitizeSession(value: unknown): HaruDemoSession | null {
  if (!isRecord(value) || !isHaruWeekDay(value.day)) return null;

  const status = value.status;
  if (
    typeof status !== "string" ||
    !SESSION_STATUSES.has(status as HaruDemoSessionStatus) ||
    !isValidIsoDate(value.startedAt)
  ) {
    return null;
  }

  const sanitizedQuestionIds = sanitizeStringArray(value.questionIds) ?? [];
  const questionIds = Array.from(new Set(sanitizedQuestionIds));
  const hasInvalidQuestionIds =
    !Array.isArray(value.questionIds) ||
    sanitizedQuestionIds.length !== value.questionIds.length ||
    questionIds.length !== sanitizedQuestionIds.length;
  const questionIdSet = new Set(questionIds);
  const responseByQuestion = new Map<string, HaruDemoResponse>();
  let hasInvalidResponses = !Array.isArray(value.responses);
  let hasUnknownResponses = false;
  let hasDuplicateResponses = false;

  if (Array.isArray(value.responses)) {
    for (const candidate of value.responses) {
      const response = sanitizeResponse(candidate);
      if (!response) {
        hasInvalidResponses = true;
        continue;
      }
      if (!questionIdSet.has(response.questionId)) {
        hasUnknownResponses = true;
        continue;
      }
      if (responseByQuestion.has(response.questionId)) {
        hasDuplicateResponses = true;
      }
      responseByQuestion.set(response.questionId, response);
    }
  }

  const endedAt = isValidIsoDate(value.endedAt) ? value.endedAt : null;
  const durationSeconds = sanitizeNonNegativeNumber(value.durationSeconds) ?? null;
  const completionMessage =
    typeof value.completionMessage === "string" ? value.completionMessage : null;

  const session: HaruDemoSession = {
    day: value.day,
    status: status as HaruDemoSessionStatus,
    questionIds,
    questionCount: questionIds.length,
    startedAt: value.startedAt,
    endedAt,
    durationSeconds,
    completionMessage,
    responses: questionIds
      .map((questionId) => responseByQuestion.get(questionId))
      .filter((response): response is HaruDemoResponse => response !== undefined),
  };

  if (
    session.status === "completed" &&
    (hasInvalidQuestionIds ||
      hasInvalidResponses ||
      hasUnknownResponses ||
      hasDuplicateResponses ||
      !hasExactValidResponseSet(session))
  ) {
    return {
      ...session,
      status: "in_progress",
      endedAt: null,
      durationSeconds: null,
      completionMessage: null,
    };
  }

  return session;
}

function dispatchSessionUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HARU_DEMO_SESSION_UPDATED_EVENT));
  }
}

function saveSessions(sessions: HaruDemoSession[]): boolean {
  const didWrite = writeJson(
    HARU_DEMO_SESSION_STORAGE_KEY,
    [...sessions].sort((left, right) => left.day - right.day),
  );
  if (didWrite) {
    dispatchSessionUpdated();
  }
  return didWrite;
}

export function clearHaruDemoSessions(): void {
  removeKey(HARU_DEMO_SESSION_STORAGE_KEY);
  dispatchSessionUpdated();
}

export function getHaruDemoSessions(): HaruDemoSession[] {
  return readJsonArray<unknown>(HARU_DEMO_SESSION_STORAGE_KEY)
    .map(sanitizeSession)
    .filter((session): session is HaruDemoSession => session !== null)
    .sort((left, right) => left.day - right.day);
}

export function startHaruDemoSession(
  day: HaruWeekDay,
  questionIds: readonly string[],
  now: Date = new Date(),
): HaruDemoSession {
  const safeQuestionIds = Array.from(
    new Set(
      questionIds
        .map(sanitizeString)
        .filter((questionId): questionId is string => questionId !== undefined),
    ),
  );
  const sessions = getHaruDemoSessions();
  const existingIndex = sessions.findIndex((candidate) => candidate.day === day);
  const existing = sessions[existingIndex];

  if (existing?.status === "completed") {
    return existing;
  }

  if (existing) {
    const allowedQuestionIds = new Set(safeQuestionIds);
    const resumed: HaruDemoSession = {
      ...existing,
      status: "in_progress",
      questionIds: safeQuestionIds,
      questionCount: safeQuestionIds.length,
      startedAt:
        existing.status === "abandoned" ? toIsoString(now) : existing.startedAt,
      endedAt: null,
      durationSeconds: null,
      completionMessage: null,
      responses: existing.responses.filter((response) =>
        allowedQuestionIds.has(response.questionId),
      ),
    };
    sessions[existingIndex] = resumed;
    saveSessions(sessions);
    return resumed;
  }

  const session: HaruDemoSession = {
    day,
    status: "in_progress",
    questionIds: safeQuestionIds,
    questionCount: safeQuestionIds.length,
    startedAt: toIsoString(now),
    endedAt: null,
    durationSeconds: null,
    completionMessage: null,
    responses: [],
  };

  saveSessions([...sessions, session]);
  return session;
}

export function recordHaruDemoResponse(
  day: HaruWeekDay,
  response: HaruDemoResponse,
): HaruDemoSession | null {
  const sessions = getHaruDemoSessions();
  const sessionIndex = sessions.findIndex((candidate) => candidate.day === day);
  const session = sessions[sessionIndex];
  const safeResponse = sanitizeResponse(response);

  if (
    !session ||
    session.status !== "in_progress" ||
    !safeResponse ||
    !session.questionIds.includes(safeResponse.questionId)
  ) {
    return null;
  }

  const existingIndex = session.responses.findIndex(
    (candidate) => candidate.questionId === safeResponse.questionId,
  );
  const nextResponses = [...session.responses];
  if (existingIndex >= 0) {
    nextResponses[existingIndex] = safeResponse;
  } else {
    nextResponses.push(safeResponse);
  }

  const responseByQuestion = new Map(
    nextResponses.map((candidate) => [candidate.questionId, candidate]),
  );
  const nextSession: HaruDemoSession = {
    ...session,
    responses: session.questionIds
      .map((questionId) => responseByQuestion.get(questionId))
      .filter((candidate): candidate is HaruDemoResponse => candidate !== undefined),
  };
  sessions[sessionIndex] = nextSession;
  saveSessions(sessions);
  return nextSession;
}

function endHaruDemoSession(
  day: HaruWeekDay,
  status: Extract<HaruDemoSessionStatus, "completed" | "abandoned">,
  completionMessage: string | null,
  now: Date,
): HaruDemoSession | null {
  const sessions = getHaruDemoSessions();
  const sessionIndex = sessions.findIndex((candidate) => candidate.day === day);
  const session = sessions[sessionIndex];

  if (!session) return null;
  if (session.status !== "in_progress") return session;
  if (status === "completed" && !hasExactValidResponseSet(session)) {
    return session;
  }

  const endedAt = toIsoString(now);
  const elapsedMs = new Date(endedAt).getTime() - new Date(session.startedAt).getTime();
  const nextSession: HaruDemoSession = {
    ...session,
    status,
    endedAt,
    durationSeconds: Math.max(0, Math.round(elapsedMs / 1000)),
    completionMessage,
  };
  sessions[sessionIndex] = nextSession;
  return saveSessions(sessions) ? nextSession : null;
}

export function completeHaruDemoSession(
  day: HaruWeekDay,
  completionMessage: string,
  now: Date = new Date(),
): HaruDemoSession | null {
  return endHaruDemoSession(day, "completed", completionMessage, now);
}

export function abandonHaruDemoSession(
  day: HaruWeekDay,
  now: Date = new Date(),
): HaruDemoSession | null {
  return endHaruDemoSession(day, "abandoned", null, now);
}
