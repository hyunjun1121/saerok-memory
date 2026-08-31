import type { MarketCode } from "@/config/market";
import {
  getHaruConsentRevision,
  type HaruConsentState,
} from "@/features/profile/haruConsentStorage";
import { getHaruEnrollment } from "@/features/profile/haruEnrollment";

export interface HaruDataApiOptions {
  market: MarketCode;
  fetchImplementation?: typeof fetch;
}

export type HaruActivitySessionState =
  | "started"
  | "paused"
  | "resumed"
  | "exit_observed"
  | "completed";

export interface HaruActivitySessionInput {
  sessionId: string;
  state: HaruActivitySessionState;
  occurredAt: string;
  contentPackVersion: string;
  consentRevision: string;
  progressPercent: number;
  activeDurationMs: number;
  wallDurationMs: number;
  lastQuestionInstanceId?: string;
}

export interface HaruQuestionAttemptInput {
  sessionId: string;
  questionInstanceId: string;
  questionId: string;
  questionType: string;
  contentPackVersion: string;
  presentedAt: string;
  completedAt?: string;
  activeDurationMs: number;
  wallDurationMs: number;
  firstInteractionMs?: number;
  confirmationLatencyMs?: number;
  response?: {
    selectedOptionIds?: string[];
    sequenceIds?: string[];
    isCorrect?: boolean;
    isValid?: boolean;
    retryCount?: number;
    hintCount?: number;
    skipReason?: string;
  };
}

export type HaruExportCategory =
  | "profile"
  | "consents"
  | "sessions"
  | "attempts"
  | "memory"
  | "caregiver"
  | "telemetry";

export type HaruDeletionCategory =
  | "profile"
  | "activity"
  | "memory"
  | "voice"
  | "caregiver"
  | "telemetry"
  | "all";

export interface HaruRemoteDataExport {
  schemaVersion: "1.0";
  market: MarketCode;
  generatedAt: string;
  data: Record<string, unknown>;
}

export type HaruRemoteDeletionState =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export interface HaruRemoteDeletionStatus {
  requestId: string;
  status: HaruRemoteDeletionState;
  requestedAt: string;
  completedAt: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function requestJson(
  path: string,
  init: RequestInit,
  options: HaruDataApiOptions,
): Promise<unknown | null> {
  if (!getHaruEnrollment(options.market)) return null;
  const fetchImplementation = options.fetchImplementation ?? fetch;
  try {
    const response = await fetchImplementation(path, {
      credentials: "same-origin",
      ...init,
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function postJson(
  path: string,
  body: unknown,
  options: HaruDataApiOptions,
): Promise<boolean> {
  if (!getHaruEnrollment(options.market)) return false;
  const fetchImplementation = options.fetchImplementation ?? fetch;
  try {
    const response = await fetchImplementation(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function submitHaruConsentReceipt(
  consent: HaruConsentState,
  options: HaruDataApiOptions,
): Promise<boolean> {
  return postJson(
    "/api/privacy/v1/consents",
    {
      revision: getHaruConsentRevision(consent),
      occurredAt: consent.updatedAt,
      grants: {
        usageAnalytics: consent.usageAnalytics,
        longitudinalActivity: consent.longitudinalUsageStorage,
        voiceCapture: consent.voiceRecording,
        sttProcessing: consent.sttProcessing,
        transcriptStorage: consent.transcriptStorage,
        audioStorage: consent.audioStorage,
        personalization: consent.personalizedQuestionUse,
        familySharing: consent.familySharing,
      },
    },
    options,
  );
}

export function submitHaruActivitySession(
  input: HaruActivitySessionInput,
  options: HaruDataApiOptions,
): Promise<boolean> {
  return postJson("/api/activity/v1/sessions", input, options);
}

export function submitHaruQuestionAttempt(
  input: HaruQuestionAttemptInput,
  options: HaruDataApiOptions,
): Promise<boolean> {
  return postJson("/api/activity/v1/question-attempts", input, options);
}

export function requestHaruRemoteExport(
  categories: readonly HaruExportCategory[],
  options: HaruDataApiOptions,
): Promise<boolean> {
  return postJson(
    "/api/privacy/v1/exports",
    { format: "json", categories: [...categories] },
    options,
  );
}

export async function fetchHaruRemoteExport(
  categories: readonly HaruExportCategory[],
  options: HaruDataApiOptions,
): Promise<HaruRemoteDataExport | null> {
  const payload = await requestJson(
    "/api/privacy/v1/exports",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format: "json", categories: [...categories] }),
    },
    options,
  );
  if (
    !isRecord(payload) ||
    payload.schemaVersion !== "1.0" ||
    payload.market !== options.market ||
    typeof payload.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(payload.generatedAt)) ||
    !isRecord(payload.data)
  ) {
    return null;
  }
  return {
    schemaVersion: "1.0",
    market: options.market,
    generatedAt: payload.generatedAt,
    data: payload.data,
  };
}

export function requestHaruRemoteDeletion(
  requestId: string,
  categories: readonly HaruDeletionCategory[],
  options: HaruDataApiOptions,
): Promise<boolean> {
  return postJson(
    "/api/privacy/v1/deletions",
    { requestId, categories: [...categories] },
    options,
  );
}

export async function getHaruRemoteDeletionStatus(
  requestId: string,
  options: HaruDataApiOptions,
): Promise<HaruRemoteDeletionStatus | null> {
  const payload = await requestJson(
    `/api/privacy/v1/deletions/${encodeURIComponent(requestId)}`,
    { method: "GET" },
    options,
  );
  const allowedStates: readonly HaruRemoteDeletionState[] = [
    "queued",
    "processing",
    "completed",
    "failed",
  ];
  if (
    !isRecord(payload) ||
    payload.requestId !== requestId ||
    typeof payload.status !== "string" ||
    !allowedStates.includes(payload.status as HaruRemoteDeletionState) ||
    typeof payload.requestedAt !== "string" ||
    !Number.isFinite(Date.parse(payload.requestedAt)) ||
    !(
      payload.completedAt === null ||
      (typeof payload.completedAt === "string" &&
        Number.isFinite(Date.parse(payload.completedAt)))
    )
  ) {
    return null;
  }
  return {
    requestId,
    status: payload.status as HaruRemoteDeletionState,
    requestedAt: payload.requestedAt,
    completedAt: payload.completedAt,
  };
}
