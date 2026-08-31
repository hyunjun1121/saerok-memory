export const TELEMETRY_SCHEMA_VERSION = "1.0" as const;

export type TelemetryMarket = "kr" | "jp";
export type TelemetryLocale = "ko-KR" | "ja-JP";
export type TelemetryInputMode = "touch" | "key_action" | "voice" | "pointer";
export type TelemetryVoiceExperienceVariant = "baseline_v1" | "assist_v2";
export type TelemetryWaveformMode = "none" | "reactive_red";
export type TelemetryVoiceOutcomeReason =
  | "completed"
  | "no_speech"
  | "permission_denied"
  | "consent_required"
  | "unsupported"
  | "capture_failed"
  | "stt_queued"
  | "stt_failed"
  | "cancelled";
export type TelemetryDataClass = "product" | "activity" | "access_audit";
export type TelemetryConsentCategory =
  | "usage_analytics"
  | "longitudinal_activity"
  | "voice_capture"
  | "stt_processing"
  | "transcript_storage"
  | "audio_storage"
  | "personalization"
  | "family_sharing";

export interface TelemetryPayloadMap {
  app_opened: {
    launchKind: "fresh" | "returning" | "resume";
    online: boolean;
  };
  route_viewed: {
    navigationKind: "initial" | "push" | "replace" | "history";
  };
  app_visibility_changed: {
    visibility: "visible" | "hidden";
  };
  network_changed: {
    state: "online" | "offline";
  };
  onboarding_step: {
    stepId: string;
    state: "shown" | "completed" | "abandoned";
  };
  consent_changed: {
    category: TelemetryConsentCategory;
    granted: boolean;
    source: "onboarding" | "settings" | "withdrawal";
  };
  setting_changed: {
    settingId: string;
    valueCode: string;
  };
  routine_started: {
    routineId: string;
    dayIndex: number;
  };
  routine_paused: {
    reason: "user" | "background" | "idle";
  };
  routine_resumed: {
    resumeKind: "same_session" | "after_dropoff";
  };
  session_exit_observed: {
    reason: "pagehide" | "reload" | "close" | "route_change" | "unknown";
  };
  routine_completed: {
    questionCount: number;
    activeDurationMs: number;
    wallDurationMs: number;
  };
  question_presented: {
    questionId: string;
    exerciseType: string;
    domain: string;
    ordinal: number;
    difficulty: string;
    questionContentVersion: string;
    questionContentHash: string;
    voiceExperienceVariant?: TelemetryVoiceExperienceVariant;
    waveformMode?: TelemetryWaveformMode;
    guidanceCopyVersion?: string;
    sttPipelineVersion?: string;
  };
  question_first_interaction: {
    inputMode: TelemetryInputMode;
    latencyMs: number;
  };
  choice_changed: {
    actionId: string;
    selectionState: "selected" | "deselected";
    selectionCount: number;
    changeIndex: number;
  };
  sequence_changed: {
    action: "add" | "remove" | "reorder";
    itemId: string;
    position: number;
    itemCount: number;
  };
  pair_attempted: {
    leftId: string;
    rightId: string;
    matched: boolean;
    attempt: number;
    latencyMs: number;
  };
  answer_confirmed: {
    inputMode: TelemetryInputMode;
    responseIds: readonly string[];
    result: "correct" | "incorrect" | "unscored";
    responseTimeMs: number;
    activeResponseTimeMs: number;
    selectionChangeCount: number;
  };
  feedback_shown: {
    kind: "success" | "retry" | "neutral";
  };
  hint_used: {
    hintId: string;
    attempt: number;
  };
  retry_started: {
    attempt: number;
  };
  question_skipped: {
    reason: "user" | "timeout" | "unsupported" | "permission_denied";
  };
  question_completed: {
    attemptCount: number;
    activeDurationMs: number;
    wallDurationMs: number;
    feedbackDurationMs: number;
  };
  audio_played: {
    assetId: string;
    action: "play" | "replay";
    status: "started" | "completed" | "failed";
  };
  voice_capture_status: {
    phase: "permission" | "started" | "cancelled" | "completed" | "failed";
    permission?: "granted" | "denied" | "unavailable";
    durationMs?: number;
    sttStatus?: "not_requested" | "queued" | "completed" | "no_speech" | "failed";
    sttLatencyMs?: number;
    noSpeech?: boolean;
    voiceExperienceVariant?: TelemetryVoiceExperienceVariant;
    waveformMode?: TelemetryWaveformMode;
    guidanceCopyVersion?: string;
    sttPipelineVersion?: string;
    outcomeReason?: TelemetryVoiceOutcomeReason;
  };
  drawing_progress: {
    phase: "started" | "completed" | "cleared";
    strokeCount: number;
    pointCount: number;
    pauseCount: number;
    eraseCount: number;
    durationMs: number;
  };
  reward_earned: {
    rewardId: string;
    rewardKind: string;
  };
  pairing_status: {
    role: "caregiver" | "counselor";
    state: "issued" | "redeemed" | "expired" | "revoked" | "failed";
  };
  caregiver_observation_submitted: {
    domainCount: number;
    shared: boolean;
  };
  report_viewed: {
    reportId: string;
    role: "caregiver" | "counselor";
    sectionId?: string;
  };
  share_changed: {
    scope: "activity" | "memory" | "observation" | "report";
    granted: boolean;
  };
  export_requested: {
    scope: "all" | "profile" | "activity" | "memory" | "analytics";
  };
  deletion_requested: {
    scope: "all" | "profile" | "activity" | "memory" | "analytics" | "audio";
  };
  permission_result: {
    permission: "microphone" | "notifications" | "storage";
    state: "granted" | "denied" | "unavailable";
  };
  sync_status: {
    target: "telemetry" | "activity" | "stt" | "rag";
    state: "queued" | "sending" | "completed" | "retrying" | "failed";
    statusCode?: number;
    attempt?: number;
    latencyMs?: number;
  };
  client_error: {
    source: string;
    code: string;
    recoverable: boolean;
  };
  performance_measured: {
    metric: "lcp" | "inp" | "cls" | "api_latency" | "render_latency";
    value: number;
  };
}

export type TelemetryEventName = keyof TelemetryPayloadMap;

export interface TelemetryCommonFields {
  schemaVersion: typeof TELEMETRY_SCHEMA_VERSION;
  eventId: string;
  occurredAt: string;
  sequence: number;
  market: TelemetryMarket;
  locale: TelemetryLocale;
  appVersion: string;
  contentPackVersion: string;
  installationId: string;
  visitId: string;
  routineSessionId?: string;
  questionInstanceId?: string;
  routeId: string;
  consentRevision: string;
}

export type TelemetryEventInput<Name extends TelemetryEventName = TelemetryEventName> =
  Name extends TelemetryEventName
    ? { eventName: Name; payload: TelemetryPayloadMap[Name] }
    : never;

export type TelemetryEnvelope<Name extends TelemetryEventName = TelemetryEventName> =
  Name extends TelemetryEventName
    ? TelemetryCommonFields & { eventName: Name; payload: TelemetryPayloadMap[Name] }
    : never;

const EVENT_DATA_CLASS = {
  app_opened: "product",
  route_viewed: "product",
  app_visibility_changed: "product",
  network_changed: "product",
  onboarding_step: "product",
  consent_changed: "access_audit",
  setting_changed: "product",
  routine_started: "product",
  routine_paused: "product",
  routine_resumed: "product",
  session_exit_observed: "product",
  routine_completed: "product",
  question_presented: "product",
  question_first_interaction: "product",
  choice_changed: "product",
  sequence_changed: "activity",
  pair_attempted: "activity",
  answer_confirmed: "activity",
  feedback_shown: "product",
  hint_used: "product",
  retry_started: "product",
  question_skipped: "product",
  question_completed: "product",
  audio_played: "product",
  voice_capture_status: "activity",
  drawing_progress: "activity",
  reward_earned: "product",
  pairing_status: "access_audit",
  caregiver_observation_submitted: "access_audit",
  report_viewed: "access_audit",
  share_changed: "access_audit",
  export_requested: "access_audit",
  deletion_requested: "access_audit",
  permission_result: "access_audit",
  sync_status: "product",
  client_error: "product",
  performance_measured: "product",
} as const satisfies Record<TelemetryEventName, TelemetryDataClass>;

export function getTelemetryDataClass(eventName: TelemetryEventName): TelemetryDataClass {
  return EVENT_DATA_CLASS[eventName];
}

export function createTelemetryEnvelope<Name extends TelemetryEventName>(
  common: Omit<TelemetryCommonFields, "schemaVersion">,
  event: TelemetryEventInput<Name>,
): TelemetryEnvelope<Name> {
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    ...common,
    ...event,
  } as TelemetryEnvelope<Name>;
}
